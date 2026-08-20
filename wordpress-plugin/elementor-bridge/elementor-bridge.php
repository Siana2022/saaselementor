<?php
/**
 * Plugin Name: Elementor Bridge
 * Description: Puente REST para crear/actualizar páginas de Elementor desde fuera (skill/MCP). Mínimo y con permisos.
 * Version: 0.1.0
 * Author: Siana Digital
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('ELEBRIDGE_VERSION', '0.1.0');
define('ELEBRIDGE_NS', 'elebridge/v1');

/**
 * Permiso: usuario autenticado (Application Password) con capacidad de editar páginas.
 * Recomendado: usar un usuario con rol Editor dedicado, NO administrador.
 */
function elebridge_permission() {
    return current_user_can('edit_pages');
}

add_action('rest_api_init', function () {
    register_rest_route(ELEBRIDGE_NS, '/ping', [
        'methods'             => 'GET',
        'permission_callback' => 'elebridge_permission',
        'callback'            => 'elebridge_ping',
    ]);
    register_rest_route(ELEBRIDGE_NS, '/pages', [
        'methods'             => 'GET',
        'permission_callback' => 'elebridge_permission',
        'callback'            => 'elebridge_list_pages',
    ]);
    register_rest_route(ELEBRIDGE_NS, '/page', [
        'methods'             => 'POST',
        'permission_callback' => 'elebridge_permission',
        'callback'            => 'elebridge_upsert_page',
    ]);
    register_rest_route(ELEBRIDGE_NS, '/section', [
        'methods'             => 'POST',
        'permission_callback' => 'elebridge_permission',
        'callback'            => 'elebridge_append_section',
    ]);
    register_rest_route(ELEBRIDGE_NS, '/media', [
        'methods'             => 'POST',
        'permission_callback' => 'elebridge_permission',
        'callback'            => 'elebridge_upload_media',
    ]);
});

/** Versión de Elementor + globales del Kit (para que la skill referencie colores/tipografías). */
function elebridge_ping() {
    $data = [
        'ok'                => true,
        'plugin_version'    => ELEBRIDGE_VERSION,
        'wp_version'        => get_bloginfo('version'),
        'elementor_version' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : null,
        'theme'             => wp_get_theme()->get('Name'),
        'global_colors'     => [],
        'global_typography' => [],
    ];
    if (class_exists('\Elementor\Plugin')) {
        try {
            $kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit();
            if ($kit) {
                $data['global_colors']     = $kit->get_settings('system_colors') ?: [];
                $data['global_typography'] = $kit->get_settings('system_typography') ?: [];
                $data['custom_colors']     = $kit->get_settings('custom_colors') ?: [];
                $data['custom_typography'] = $kit->get_settings('custom_typography') ?: [];
            }
        } catch (\Throwable $e) {
            $data['kit_error'] = $e->getMessage();
        }
    }
    return new WP_REST_Response($data, 200);
}

/** Lista páginas recientes con su URL de edición de Elementor. */
function elebridge_list_pages() {
    $q = new WP_Query([
        'post_type'      => 'page',
        'posts_per_page' => 50,
        'orderby'        => 'modified',
        'order'          => 'DESC',
        'post_status'    => ['publish', 'draft', 'private'],
    ]);
    $out = [];
    foreach ($q->posts as $p) {
        $out[] = [
            'id'       => $p->ID,
            'title'    => get_the_title($p),
            'status'   => $p->post_status,
            'edit_url' => admin_url('post.php?post=' . $p->ID . '&action=elementor'),
            'view_url' => get_permalink($p),
        ];
    }
    return new WP_REST_Response($out, 200);
}

/** Escribe los metadatos de Elementor en un post y limpia la caché. */
function elebridge_write_elementor($post_id, $content_array, $template = 'elementor_canvas') {
    // _elementor_data = el array de contenido serializado (slashed), como hace Elementor.
    $json = wp_json_encode($content_array);
    update_post_meta($post_id, '_elementor_data', wp_slash($json));
    update_post_meta($post_id, '_elementor_edit_mode', 'builder');
    update_post_meta($post_id, '_elementor_template_type', 'wp-page');
    if (defined('ELEMENTOR_VERSION')) {
        update_post_meta($post_id, '_elementor_version', ELEMENTOR_VERSION);
    }
    if ($template) {
        update_post_meta($post_id, '_wp_page_template', $template);
    }
    // Limpiar caché CSS de Elementor para que el frontend refleje los cambios.
    if (class_exists('\Elementor\Plugin')) {
        try {
            \Elementor\Plugin::$instance->files_manager->clear_cache();
        } catch (\Throwable $e) {
            // no bloquear por la caché
        }
    }
}

/** Acepta el doc estándar {content:[...]} o directamente un array de elementos. */
function elebridge_extract_content($params) {
    $content = null;
    if (isset($params['content']) && is_array($params['content'])) {
        $content = $params['content'];
    } elseif (isset($params['doc']['content']) && is_array($params['doc']['content'])) {
        $content = $params['doc']['content'];
    }
    return $content;
}

/** Crea o actualiza una página con contenido de Elementor. */
function elebridge_upsert_page(WP_REST_Request $req) {
    $params  = $req->get_json_params();
    $content = elebridge_extract_content($params);
    if (!is_array($content)) {
        return new WP_Error('elebridge_bad_content', 'Falta "content" (array de elementos Elementor).', ['status' => 400]);
    }
    $title    = isset($params['title']) ? sanitize_text_field($params['title']) : 'Página (bridge)';
    $status   = isset($params['status']) && in_array($params['status'], ['publish', 'draft', 'private'], true) ? $params['status'] : 'draft';
    $template = isset($params['template']) ? sanitize_text_field($params['template']) : 'elementor_canvas';
    $page_id  = isset($params['page_id']) ? intval($params['page_id']) : 0;

    if ($page_id > 0 && get_post($page_id)) {
        wp_update_post(['ID' => $page_id, 'post_title' => $title, 'post_status' => $status]);
    } else {
        $page_id = wp_insert_post([
            'post_type'   => 'page',
            'post_title'  => $title,
            'post_status' => $status,
            'post_content' => '',
        ], true);
        if (is_wp_error($page_id)) {
            return $page_id;
        }
    }

    elebridge_write_elementor($page_id, $content, $template);

    return new WP_REST_Response([
        'ok'       => true,
        'page_id'  => $page_id,
        'edit_url' => admin_url('post.php?post=' . $page_id . '&action=elementor'),
        'view_url' => get_permalink($page_id),
    ], 200);
}

/** Añade un container de nivel superior a una página existente (construcción incremental). */
function elebridge_append_section(WP_REST_Request $req) {
    $params  = $req->get_json_params();
    $page_id = isset($params['page_id']) ? intval($params['page_id']) : 0;
    $section = isset($params['container']) && is_array($params['container']) ? $params['container'] : null;
    if (!$page_id || !get_post($page_id) || !$section) {
        return new WP_Error('elebridge_bad_section', 'Faltan "page_id" válido y "container".', ['status' => 400]);
    }
    $raw = get_post_meta($page_id, '_elementor_data', true);
    $data = $raw ? json_decode($raw, true) : [];
    if (!is_array($data)) {
        $data = [];
    }
    $data[] = $section;
    elebridge_write_elementor($page_id, $data);
    return new WP_REST_Response(['ok' => true, 'page_id' => $page_id, 'sections' => count($data)], 200);
}

/** Sube una imagen a la Media Library: por URL (sideload) o base64. Devuelve id + url. */
function elebridge_upload_media(WP_REST_Request $req) {
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $params = $req->get_json_params();

    if (!empty($params['source_url'])) {
        $tmp = download_url(esc_url_raw($params['source_url']));
        if (is_wp_error($tmp)) {
            return $tmp;
        }
        $file_array = [
            'name'     => basename(parse_url($params['source_url'], PHP_URL_PATH)) ?: 'image.jpg',
            'tmp_name' => $tmp,
        ];
        $id = media_handle_sideload($file_array, 0);
        if (is_wp_error($id)) {
            @unlink($tmp);
            return $id;
        }
        return new WP_REST_Response(['ok' => true, 'id' => $id, 'url' => wp_get_attachment_url($id)], 200);
    }

    if (!empty($params['filename']) && !empty($params['data_base64'])) {
        $bytes = base64_decode($params['data_base64']);
        if ($bytes === false) {
            return new WP_Error('elebridge_bad_b64', 'data_base64 inválido.', ['status' => 400]);
        }
        $upload = wp_upload_bits(sanitize_file_name($params['filename']), null, $bytes);
        if (!empty($upload['error'])) {
            return new WP_Error('elebridge_upload', $upload['error'], ['status' => 500]);
        }
        $filetype = wp_check_filetype($upload['file']);
        $id = wp_insert_attachment([
            'post_mime_type' => $filetype['type'],
            'post_title'     => sanitize_file_name($params['filename']),
            'post_status'    => 'inherit',
        ], $upload['file']);
        if (is_wp_error($id)) {
            return $id;
        }
        wp_update_attachment_metadata($id, wp_generate_attachment_metadata($id, $upload['file']));
        return new WP_REST_Response(['ok' => true, 'id' => $id, 'url' => wp_get_attachment_url($id)], 200);
    }

    return new WP_Error('elebridge_media_args', 'Envía "source_url" o ("filename" + "data_base64").', ['status' => 400]);
}
