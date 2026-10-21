const PASSWORD = "customfit";
const COOKIE = "smoosh_access";

function loginPage(error = false) {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a0908"><title>Smoosh</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#0a0908;color:#e8ddc8}body{min-height:100svh;font-family:Arial,Helvetica,sans-serif;padding:max(20px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));display:flex;align-items:center;justify-content:center}.gate{width:min(100%,620px);border-top:1px solid #e13b32;border-bottom:1px solid #3b3530;padding:16px 0 24px}.meta{display:flex;justify-content:space-between;gap:16px;font-size:.62rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#958b7b}.meta span:first-child{color:#e13b32}h1{font-size:clamp(4.25rem,20vw,9rem);font-weight:700;letter-spacing:-.075em;line-height:.82;margin:clamp(70px,16vh,150px) 0 clamp(40px,8vh,70px);white-space:nowrap}h1 i{font-style:normal;color:#e13b32}form{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;border-bottom:1px solid #958b7b}input{width:100%;min-width:0;border:0;background:transparent;color:#e8ddc8;font:500 16px Arial,Helvetica,sans-serif;padding:16px 0;outline:0}input::placeholder{color:#665f56}button{min-height:48px;border:0;background:transparent;color:#e13b32;font:700 .68rem Arial,Helvetica,sans-serif;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;padding:0 2px 0 18px}.error{color:#e13b32;font:700 .62rem Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;margin:12px 0 0;min-height:1em}@media(max-width:480px){body{align-items:stretch}.gate{min-height:calc(100svh - 40px);display:flex;flex-direction:column}.meta{font-size:.55rem;letter-spacing:.12em}.meta span:last-child{text-align:right}h1{font-size:clamp(4rem,25vw,6.6rem);margin:auto 0 48px}.error{margin-bottom:2px}}@media(max-height:560px){h1{margin:45px 0 32px;font-size:clamp(3.8rem,18vw,6rem)}}
</style></head><body><main class="gate"><div class="meta"><span>Smoosh</span><span>private listening</span></div><h1>Smoosh<i>.</i></h1><form method="post" action="/__login"><input type="password" name="password" placeholder="password" autofocus autocomplete="current-password" aria-label="Password"><button type="submit">Enter →</button></form><p class="error">${error ? "That’s not it." : ""}</p></main></body></html>`, { status: error ? 401 : 200, headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
}

function hasAccess(request) {
  const cookie = request.headers.get("Cookie") || "";
  return cookie.split(";").some(v => v.trim() === `${COOKIE}=yes`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/__login" && request.method === "POST") {
      const form = await request.formData();
      if (form.get("password") === PASSWORD) {
        return new Response(null, { status: 303, headers: { "Location": "/", "Set-Cookie": `${COOKIE}=yes; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`, "Cache-Control": "no-store" } });
      }
      return loginPage(true);
    }
    if (!hasAccess(request)) return loginPage(false);
    return env.ASSETS.fetch(request);
  }
};
