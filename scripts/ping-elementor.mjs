#!/usr/bin/env node
/** Comprueba la conexión con el plugin y muestra versión + globales del Kit. */
function arg(n){const i=process.argv.indexOf(`--${n}`);return i>=0?process.argv[i+1]:undefined;}
const url=(arg("url")||"").replace(/\/+$/,""), user=arg("user"), pass=arg("pass");
if(!url||!user||!pass){console.error("Uso: --url --user --pass");process.exit(1);}
const auth="Basic "+Buffer.from(`${user}:${pass}`).toString("base64");
const res=await fetch(`${url}/?rest_route=/elebridge/v1/ping`,{headers:{Authorization:auth}});
const t=await res.text();
console.log(res.status, t);
