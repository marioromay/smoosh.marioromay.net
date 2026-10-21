const PASSWORD = "smooshsmoosh";
const COOKIE = "smoosh_access";

function loginPage(error = false) {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0a0908"><title>Smoosh</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#0a0908;color:#e8ddc8}body{min-height:100svh;font-family:Georgia,"Times New Roman",serif;display:grid;place-items:center;padding:24px}.gate{width:min(100%,620px);border-top:1px solid #e13b32;border-bottom:1px solid #3b3530;padding:18px 0 32px}.meta{display:flex;justify-content:space-between;font:700 .62rem Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#958b7b}.meta span:first-child{color:#e13b32}h1{font-size:clamp(5rem,22vw,10rem);font-weight:400;letter-spacing:-.075em;line-height:.8;margin:18vh 0 50px}h1 i{font-style:normal;color:#e13b32}.prompt{font-size:1.35rem;margin:0 0 18px}form{display:grid;grid-template-columns:1fr auto;border-bottom:1px solid #958b7b}input{min-width:0;border:0;background:transparent;color:#e8ddc8;font:italic 1.3rem Georgia,serif;padding:15px 0;outline:0}input::placeholder{color:#665f56}button{border:0;background:transparent;color:#e13b32;font:700 .68rem Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;padding:0 4px 0 20px}.error{color:#e13b32;font:700 .62rem Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;margin:12px 0 0;min-height:1em}
</style></head><body><main class="gate"><div class="meta"><span>Smoosh</span><span>private listening</span></div><h1>Smoosh<i>.</i></h1><p class="prompt">Between us.</p><form method="post" action="/__login"><input type="password" name="password" placeholder="password" autofocus autocomplete="current-password" aria-label="Password"><button type="submit">Enter →</button></form><p class="error">${error ? "That’s not it." : ""}</p></main></body></html>`, { status: error ? 401 : 200, headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
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
