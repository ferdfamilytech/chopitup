import { useState, useEffect, useRef, useCallback } from "react";
import Parse from "parse/dist/parse.min.js";

// ── PARSE / BACK4APP INIT ──────────────────────────────────
// Replace with your keys from back4app.com → Your App → Security & Keys
const PARSE_APP_ID = import.meta.env.VITE_PARSE_APP_ID || mBjnnVdvIc0aCcCA9B6GPIjumASWsziMxkrc0z08;
const PARSE_JS_KEY = import.meta.env.VITE_PARSE_JS_KEY || 3iFmmdy1t9mKtd2V6wM7FiVycaoQcT07a7IWTJTa;
const PARSE_SERVER  = import.meta.env.VITE_PARSE_SERVER || "https://parseapi.back4app.com";

Parse.initialize(PARSE_APP_ID, PARSE_JS_KEY);
Parse.serverURL = PARSE_SERVER;

// ── PARSE SERVICE LAYER ────────────────────────────────────
const ParseService = {

  // ── AUTH ──
  async signUp(email, password, name, role){
    const user = new Parse.User();
    user.set("username", email.toLowerCase().trim());
    user.set("email",    email.toLowerCase().trim());
    user.set("password", password);
    user.set("name",     name);
    user.set("role",     role);
    await user.signUp();
    return user;
  },

  async logIn(email, password){
    return await Parse.User.logIn(email.toLowerCase().trim(), password);
  },

  async logOut(){
    await Parse.User.logOut();
  },

  async resetPassword(email){
    await Parse.User.requestPasswordReset(email.toLowerCase().trim());
  },

  currentUser(){
    return Parse.User.current();
  },

  // ── SHOP PROFILE ──
  async saveShopProfile(data){
    const user = Parse.User.current();
    if(!user) return;
    Object.entries(data).forEach(([k,v]) => user.set(k, v));
    await user.save();
    return user;
  },

  async getShopProfile(){
    const user = Parse.User.current();
    if(!user) return null;
    return {
      shopName:   user.get("shopName")   || user.get("name") || "My Shop",
      barberName: user.get("name")       || "Barber",
      location:   user.get("location")   || "",
      phone:      user.get("phone")      || "",
      role:       user.get("role")       || "barber",
    };
  },

  // ── APPOINTMENTS ──
  async getAppointments(dateStr){
    const Appointment = Parse.Object.extend("Appointment");
    const q = new Parse.Query(Appointment);
    q.equalTo("owner", Parse.User.current());
    if(dateStr) q.equalTo("dateStr", dateStr);
    q.descending("createdAt");
    q.limit(200);
    const results = await q.find();
    return results.map(a => ({
      id:        a.id,
      parseObj:  a,
      name:      a.get("clientName")  || "",
      service:   a.get("service")     || "",
      time:      a.get("time")        || "",
      price:     a.get("price")       || 0,
      phone:     a.get("phone")       || "",
      recurring: a.get("recurring")   || null,
      status:    a.get("status")      || "confirmed",
      dateStr:   a.get("dateStr")     || "",
      note:      a.get("note")        || "",
    }));
  },

  async addAppointment(data){
    const Appointment = Parse.Object.extend("Appointment");
    const a = new Appointment();
    a.set("owner",      Parse.User.current());
    a.set("clientName", data.name    || "");
    a.set("service",    data.service || "");
    a.set("time",       data.time    || "");
    a.set("price",      Number(data.price) || 0);
    a.set("phone",      data.phone   || "");
    a.set("recurring",  data.recurring || null);
    a.set("status",     data.status  || "confirmed");
    a.set("dateStr",    data.dateStr || new Date().toLocaleDateString());
    a.set("note",       data.note    || "");
    const acl = new Parse.ACL(Parse.User.current());
    a.setACL(acl);
    const saved = await a.save();
    return {...data, id: saved.id, parseObj: saved};
  },

  async deleteAppointment(id){
    const Appointment = Parse.Object.extend("Appointment");
    const q = new Parse.Query(Appointment);
    const a = await q.get(id);
    await a.destroy();
  },

  // ── CLIENTS ──
  async getClients(){
    const Client = Parse.Object.extend("Client");
    const q = new Parse.Query(Client);
    q.equalTo("owner", Parse.User.current());
    q.descending("visits");
    q.limit(500);
    const results = await q.find();
    return results.map(c => ({
      id:           c.id,
      parseObj:     c,
      name:         c.get("name")          || "",
      phone:        c.get("phone")         || "",
      avatar:       (c.get("name")||"?")[0].toUpperCase(),
      visits:       c.get("visits")        || 0,
      spent:        c.get("spent")         || 0,
      lastVisit:    c.get("lastVisit")     || "—",
      nextVisit:    c.get("nextVisit")     || "—",
      preferredSvc: c.get("preferredSvc")  || "",
      points:       c.get("points")        || 0,
      tier:         c.get("tier")          || "Bronze",
      noShows:      c.get("noShows")       || 0,
      recurring:    c.get("recurring")     || null,
      notes:        c.get("notes")         || "",
      gradient:     [c.get("gradientA")||"#C9A84C", c.get("gradientB")||"#7A6230"],
    }));
  },

  async addClient(data){
    const Client = Parse.Object.extend("Client");
    const c = new Client();
    c.set("owner",        Parse.User.current());
    c.set("name",         data.name        || "");
    c.set("phone",        data.phone       || "");
    c.set("visits",       data.visits      || 0);
    c.set("spent",        data.spent       || 0);
    c.set("points",       data.points      || 0);
    c.set("tier",         data.tier        || "Bronze");
    c.set("noShows",      data.noShows     || 0);
    c.set("preferredSvc", data.preferredSvc|| "");
    c.set("lastVisit",    data.lastVisit   || "—");
    c.set("gradientA",    "#C9A84C");
    c.set("gradientB",    "#7A6230");
    const acl = new Parse.ACL(Parse.User.current());
    c.setACL(acl);
    const saved = await c.save();
    return {...data, id: saved.id, avatar: (data.name||"?")[0].toUpperCase(), gradient:["#C9A84C","#7A6230"]};
  },

  async updateClient(id, data){
    const Client = Parse.Object.extend("Client");
    const q = new Parse.Query(Client);
    const c = await q.get(id);
    Object.entries(data).forEach(([k,v]) => {
      if(k !== "id" && k !== "parseObj" && k !== "avatar" && k !== "gradient") c.set(k, v);
    });
    await c.save();
  },

  // ── TRANSACTIONS ──
  async getTransactions(limit=50){
    const Tx = Parse.Object.extend("Transaction");
    const q = new Parse.Query(Tx);
    q.equalTo("owner", Parse.User.current());
    q.descending("createdAt");
    q.limit(limit);
    const results = await q.find();
    return results.map(t => ({
      id:      t.id,
      name:    t.get("clientName") || "",
      service: t.get("service")    || "",
      amount:  t.get("amount")     || 0,
      tip:     t.get("tip")        || 0,
      date:    t.get("dateLabel")  || "Today",
      icon:    t.get("icon")       || "✂️",
      type:    t.get("txType")     || "in",
      method:  t.get("method")     || "cash",
    }));
  },

  async addTransaction(data){
    const Tx = Parse.Object.extend("Transaction");
    const t = new Tx();
    t.set("owner",      Parse.User.current());
    t.set("clientName", data.name    || "");
    t.set("service",    data.service || "");
    t.set("amount",     Number(data.amount) || 0);
    t.set("tip",        Number(data.tip)    || 0);
    t.set("dateLabel",  data.date    || "Today");
    t.set("icon",       data.icon    || "✂️");
    t.set("txType",     data.type    || "in");
    t.set("method",     data.method  || "cash");
    const acl = new Parse.ACL(Parse.User.current());
    t.setACL(acl);
    await t.save();
  },

  // ── WAITLIST ──
  async getWaitlist(){
    const WL = Parse.Object.extend("Waitlist");
    const q = new Parse.Query(WL);
    q.equalTo("owner", Parse.User.current());
    q.ascending("position");
    q.limit(100);
    const results = await q.find();
    return results.map(w => ({
      id:       w.id,
      parseObj: w,
      name:     w.get("name")    || "",
      service:  w.get("service") || "",
      phone:    w.get("phone")   || "",
      eta:      w.get("eta")     || "—",
      note:     w.get("note")    || "",
      position: w.get("position")|| 0,
    }));
  },

  async addToWaitlist(data){
    const WL = Parse.Object.extend("Waitlist");
    const w = new WL();
    w.set("owner",    Parse.User.current());
    w.set("name",     data.name    || "");
    w.set("service",  data.service || "");
    w.set("phone",    data.phone   || "");
    w.set("eta",      data.eta     || "—");
    w.set("note",     data.note    || "");
    w.set("position", data.position|| 99);
    const acl = new Parse.ACL(Parse.User.current());
    w.setACL(acl);
    const saved = await w.save();
    return {...data, id: saved.id};
  },

  async removeFromWaitlist(id){
    const WL = Parse.Object.extend("Waitlist");
    const q = new Parse.Query(WL);
    const w = await q.get(id);
    await w.destroy();
  },

  // ── OAUTH HELPERS ──
  // After Google/Apple returns a token we find-or-create a Parse user
  async oauthFindOrCreate({email, name, provider}){
    // Try login first, fall back to signup with a random password
    const tempPass = btoa(email + provider + "chopitup2025").slice(0,20);
    try{
      return await Parse.User.logIn(email.toLowerCase().trim(), tempPass);
    } catch(loginErr){
      // User doesn't exist yet — create them
      const user = new Parse.User();
      user.set("username",  email.toLowerCase().trim());
      user.set("email",     email.toLowerCase().trim());
      user.set("password",  tempPass);
      user.set("name",      name || email.split("@")[0]);
      user.set("role",      "barber");
      user.set("provider",  provider);
      try{
        await user.signUp();
        return user;
      } catch(signUpErr){
        // Username taken but wrong password (edge case) — regenerate
        if(signUpErr.code === 202){
          throw new Error("An account with this email already exists. Please sign in with email instead.");
        }
        throw signUpErr;
      }
    }
  },
};

// ── OAUTH SCRIPT LOADER ────────────────────────────────────
function loadScript(src, id){
  return new Promise((resolve, reject)=>{
    if(document.getElementById(id)){ resolve(); return; }
    const s = document.createElement("script");
    s.id = id; s.src = src; s.async = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Decode a JWT payload without verifying signature (client-side only)
function decodeJWT(token){
  try{
    const base64 = token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(atob(base64));
  } catch(e){ return {}; }
}


// ── DESIGN TOKENS ──
const C = {
  bg:"#0D0D0D",surface:"#161616",card:"#1E1E1E",border:"#2A2A2A",
  gold:"#C9A84C",goldLight:"#E8C96A",goldDim:"#7A6230",
  text:"#F0EDE8",muted:"#888",dim:"#555",
  green:"#4CAF7A",red:"#E05252",blue:"#5B9CF6",
  purple:"#A78BFA",orange:"#F59E0B",pink:"#F472B6",
};

// ── GLOBAL CSS ──
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
.app{font-family:'DM Sans',sans-serif;background:${C.bg};color:${C.text};min-height:100vh;max-width:430px;margin:0 auto;display:flex;flex-direction:column;position:relative;overflow:hidden}

/* --- SPLASH --- */
.splash{position:fixed;inset:0;background:${C.bg};z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;max-width:430px;left:50%;transform:translateX(-50%)}
.splash-logo{opacity:0;transform:translateY(24px);animation:splashIn .8s .2s ease forwards}
.splash-sub{opacity:0;transform:translateY(16px);animation:splashIn .6s .7s ease forwards}
.splash-bar{opacity:0;animation:splashIn .4s 1s ease forwards}
.splash-exit{animation:splashOut .4s ease forwards}
@keyframes splashIn{to{opacity:1;transform:translateY(0)}}
@keyframes splashOut{to{opacity:0;transform:scale(1.06)}}
.scissor-spin{display:inline-block;animation:scissors 2s .3s ease-in-out infinite alternate}
@keyframes scissors{0%{transform:rotate(-15deg) scale(1)}100%{transform:rotate(15deg) scale(1.1)}}
.splash-ring{width:120px;height:120px;border-radius:50%;border:1px solid rgba(201,168,76,.2);display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:28px}
.splash-ring::before{content:'';position:absolute;inset:-8px;border-radius:50%;border:1px solid rgba(201,168,76,.08)}
.splash-ring::after{content:'';position:absolute;inset:8px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,.12),transparent)}
.splash-progress{height:2px;background:${C.border};border-radius:1px;overflow:hidden;width:120px;margin-top:32px}
.splash-progress-fill{height:100%;background:linear-gradient(90deg,${C.goldDim},${C.gold});border-radius:1px;animation:splashLoad 1.4s ease forwards}
@keyframes splashLoad{0%{width:0}60%{width:70%}100%{width:100%}}

/* --- SCREEN TRANSITIONS --- */
.screen-enter{animation:screenIn .3s ease forwards}
.screen-exit{animation:screenOut .2s ease forwards}
@keyframes screenIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes screenOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-8px)}}

/* --- AUTH --- */
.auth{min-height:100vh;display:flex;flex-direction:column;padding:0;background:${C.bg};position:relative;overflow:hidden}
.auth-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(201,168,76,.18) 0%,transparent 70%);pointer-events:none}
.auth-bg2{position:absolute;bottom:-100px;left:-60px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,.06),transparent 70%);pointer-events:none}
.auth-card{background:${C.surface};border-radius:28px 28px 0 0;padding:32px 24px 44px;border-top:1px solid ${C.border};margin-top:auto;animation:su .4s ease}
.auth-tab{flex:1;padding:10px;text-align:center;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;color:${C.muted}}
.auth-tab.act{background:${C.card};color:${C.gold};box-shadow:0 2px 8px rgba(0,0,0,.3)}
.social-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:13px;background:${C.card};border:1px solid ${C.border};border-radius:12px;color:${C.text};font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:all .18s}
.social-btn:active{border-color:${C.gold};background:rgba(201,168,76,.05)}
.divider{display:flex;align-items:center;gap:12px;margin:16px 0}
.divider-line{flex:1;height:1px;background:${C.border}}
.divider-txt{font-size:12px;color:${C.dim}}
.role-card{background:${C.card};border:2px solid ${C.border};border-radius:16px;padding:18px;cursor:pointer;transition:all .2s;text-align:center}
.role-card.sel{border-color:${C.gold};background:rgba(201,168,76,.06)}
.role-card:active{transform:scale(.97)}

/* --- ONBOARDING --- */
.ob-step{display:flex;flex-direction:column;min-height:100vh;background:${C.bg};position:relative;overflow:hidden}
.ob-bg{position:absolute;top:-80px;right:-80px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,.1),transparent 70%);pointer-events:none}
.ob-progress{display:flex;gap:6px;padding:0 24px;margin-bottom:32px}
.ob-dot{height:3px;border-radius:2px;background:${C.border};transition:all .4s ease;flex:1}
.ob-dot.act{background:${C.gold}}
.ob-dot.done{background:${C.goldDim}}
.ob-icon-ring{width:80px;height:80px;border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:24px;border:1px solid rgba(201,168,76,.2);background:radial-gradient(circle at 30% 30%,rgba(201,168,76,.15),rgba(201,168,76,.03))}
.day-chip{padding:8px 4px;border-radius:10px;background:${C.card};border:1px solid ${C.border};text-align:center;cursor:pointer;transition:all .18s;font-size:12px;font-weight:600}
.day-chip.sel{background:rgba(201,168,76,.1);border-color:${C.gold};color:${C.gold}}
.svc-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid ${C.border}}
.price-inp{background:${C.surface};border:1px solid ${C.border};border-radius:8px;padding:7px 10px;color:${C.text};font-family:'DM Sans',sans-serif;font-size:13px;width:70px;outline:none;text-align:right}
.price-inp:focus{border-color:${C.gold}}

/* --- CLIENT BOOKING --- */
.booking{background:${C.bg};min-height:100vh;max-width:430px;margin:0 auto;position:relative}
.booking-hero{background:linear-gradient(180deg,rgba(201,168,76,.15) 0%,${C.bg} 100%);padding:32px 24px 24px;position:relative;overflow:hidden}
.booking-hero::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,.12),transparent 70%)}
.svc-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
.svc-card.sel{border-color:${C.gold};background:rgba(201,168,76,.06)}
.svc-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(201,168,76,.04),transparent);opacity:0;transition:opacity .2s}
.svc-card.sel::before{opacity:1}
.svc-card:active{transform:scale(.98)}
.date-scroll{display:flex;gap:10px;overflow-x:auto;padding:4px 0 12px;scrollbar-width:none}
.date-scroll::-webkit-scrollbar{display:none}
.date-chip{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 12px;border-radius:12px;background:${C.card};border:1px solid ${C.border};cursor:pointer;transition:all .18s;min-width:52px;flex-shrink:0}
.date-chip.sel{background:rgba(201,168,76,.1);border-color:${C.gold}}
.date-chip:active{transform:scale(.95)}
.time-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.time-chip{background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:11px;text-align:center;cursor:pointer;transition:all .18s;font-size:13px;font-weight:500}
.time-chip.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}
.time-chip.taken{opacity:.3;cursor:not-allowed;text-decoration:line-through}
.time-chip:not(.taken):active{transform:scale(.96)}
.booking-confirm{background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(201,168,76,.04));border:1px solid rgba(201,168,76,.25);border-radius:18px;padding:20px;margin-bottom:20px}
.booking-success{display:flex;flex-direction:column;align-items:center;text-align:center;padding:40px 24px;animation:screenIn .4s ease}
.confetti-icon{font-size:60px;animation:bounce 1s ease infinite alternate}
@keyframes bounce{0%{transform:translateY(0)}100%{transform:translateY(-10px)}}

/* --- WAITLIST & NO-SHOW --- */
.wl-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;position:relative;overflow:hidden;transition:all .2s}
.wl-card:active{border-color:${C.gold}}
.wl-rank{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;font-family:'Playfair Display',serif;flex-shrink:0}
.wl-rank.r1{background:linear-gradient(135deg,${C.gold},${C.goldLight});color:#0D0D0D}
.wl-rank.r2{background:rgba(201,168,76,.15);color:${C.gold}}
.wl-rank.rn{background:${C.surface};color:${C.muted}}
.wl-strip{position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:16px 0 0 16px}
.ns-row{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid ${C.border}}
.ns-avatar{border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:#0D0D0D;flex-shrink:0}
.risk-bar{height:6px;border-radius:3px;background:${C.border};overflow:hidden;margin-top:4px}
.risk-fill{height:100%;border-radius:3px;transition:width .5s ease}
.fee-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700}
.fee-charged{background:rgba(76,175,122,.12);color:${C.green};border:1px solid rgba(76,175,122,.25)}
.fee-pending{background:rgba(245,158,11,.12);color:${C.orange};border:1px solid rgba(245,158,11,.25)}
.fee-waived{background:rgba(136,136,136,.12);color:${C.muted};border:1px solid ${C.border}}
/* alert pulse */
.alert-pulse{animation:alertPulse 2s ease infinite}
@keyframes alertPulse{0%,100%{box-shadow:0 0 0 0 rgba(224,82,82,.4)}50%{box-shadow:0 0 0 8px rgba(224,82,82,0)}}
/* swipe hint */
.swipe-hint{font-size:11px;color:${C.dim};text-align:center;margin-bottom:10px;letter-spacing:.3px}
/* stat pill row */
.stat-pill-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.stat-pill-row::-webkit-scrollbar{display:none}
.stat-pill{background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:10px 14px;flex-shrink:0;text-align:center}
/* notify banner */
.notify-banner{background:linear-gradient(135deg,rgba(91,156,246,.12),rgba(91,156,246,.04));border:1px solid rgba(91,156,246,.25);border-radius:14px;padding:14px;margin-bottom:14px;display:flex;gap:12px;align-items:flex-start}
/* settings rows */
.set-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid ${C.border}}
/* danger zone */
.danger-card{background:rgba(224,82,82,.04);border:1px solid rgba(224,82,82,.2);border-radius:14px;padding:14px;margin-bottom:12px}

/* --- NOTIFICATIONS --- */
.notif-item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid ${C.border};cursor:pointer;transition:background .15s}
.notif-item.unread{background:rgba(201,168,76,.03)}
.notif-icon-wrap{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.notif-dot{width:8px;height:8px;border-radius:50%;background:${C.gold};flex-shrink:0;margin-top:6px}
.push-preview{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:12px;display:flex;gap:12px;align-items:flex-start;position:relative;overflow:hidden}
.push-preview::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}
.push-preview.appt::before{background:${C.gold}}
.push-preview.pay::before{background:${C.green}}
.push-preview.alert::before{background:${C.red}}
.push-preview.mktg::before{background:${C.purple}}
.notif-bell{position:relative;cursor:pointer;padding:4px}
.notif-count{position:absolute;top:-2px;right:-2px;width:16px;height:16px;background:${C.red};border-radius:50%;font-size:9px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center;border:2px solid ${C.bg}}

/* --- CLIENT APP VIEW --- */
.client-app{background:${C.bg};min-height:100vh;max-width:430px;margin:0 auto;position:relative}
.client-hero{background:linear-gradient(160deg,rgba(201,168,76,.2),rgba(201,168,76,.04) 60%,${C.bg});padding:32px 24px 20px;position:relative;overflow:hidden}
.client-hero::after{content:'✂️';position:absolute;right:20px;top:20px;font-size:80px;opacity:.06}
.client-appt-card{background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(201,168,76,.06));border:1px solid rgba(201,168,76,.3);border-radius:18px;padding:18px;margin-bottom:14px;position:relative;overflow:hidden}
.loyalty-ring-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px;background:${C.card};border-radius:18px;border:1px solid ${C.border};margin-bottom:14px}
.client-action-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
.client-action{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px 8px;text-align:center;cursor:pointer;transition:all .18s}
.client-action:active{transform:scale(.95);border-color:${C.gold}}
.switch-mode-btn{display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);border-radius:10px;color:${C.purple};font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif}

/* --- INVENTORY --- */
.inv-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;transition:border-color .2s;cursor:pointer}
.inv-card:active{border-color:${C.gold}}
.inv-card.low-stock{border-color:rgba(224,82,82,.3);background:rgba(224,82,82,.03)}
.inv-card.out-stock{border-color:rgba(224,82,82,.5);background:rgba(224,82,82,.06)}
.stock-bar{height:5px;border-radius:3px;background:${C.border};overflow:hidden;margin-top:6px}
.stock-fill{height:100%;border-radius:3px;transition:width .5s ease}
.qty-btn{width:32px;height:32px;border-radius:8px;border:1px solid ${C.border};background:${C.surface};color:${C.text};font-size:18px;font-weight:300;display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:'DM Sans',sans-serif}
.qty-btn:active{background:${C.card};border-color:${C.gold}}

/* --- SOCIAL --- */
.post-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden}
.platform-chip{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;border:1px solid ${C.border};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;background:${C.surface}}
.platform-chip.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}
.ai-gen-btn{background:linear-gradient(135deg,rgba(167,139,250,.2),rgba(167,139,250,.06));border:1px solid rgba(167,139,250,.3);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;width:100%;font-family:'DM Sans',sans-serif;color:${C.purple};font-size:13px;font-weight:600;transition:all .2s;margin-bottom:12px}
.ai-gen-btn:active{transform:scale(.98)}
.sched-slot{background:${C.surface};border:1px solid ${C.border};border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}

/* --- MULTI-BARBER --- */
.barber-chair{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden}
.barber-chair.active{border-color:rgba(76,175,122,.3)}
.barber-chair.busy{border-color:rgba(201,168,76,.3)}
.barber-chair.offline{opacity:.6}
.chair-status{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.chair-status.active{background:${C.green};box-shadow:0 0 8px ${C.green}}
.chair-status.busy{background:${C.gold};box-shadow:0 0 8px ${C.gold}}
.chair-status.offline{background:${C.border}}
.schedule-grid{display:grid;grid-template-columns:44px repeat(3,1fr);gap:6px;margin-bottom:16px}
.sch-cell{background:${C.surface};border-radius:8px;padding:6px;text-align:center;font-size:11px;border:1px solid ${C.border}}
.sch-cell.booked{background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.3);color:${C.gold}}
.sch-cell.free{background:rgba(76,175,122,.08);border-color:rgba(76,175,122,.2);color:${C.green}}
.sch-cell.hdr{background:transparent;border:none;font-weight:700;color:${C.muted}}
.rev-split{height:8px;border-radius:4px;overflow:hidden;display:flex;gap:2px;margin-top:6px}

/* --- SKELETON LOADERS --- */
.skel{background:linear-gradient(90deg,${C.card} 25%,${C.surface} 50%,${C.card} 75%);background-size:200% 100%;animation:skelShimmer 1.5s infinite;border-radius:8px}
@keyframes skelShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* --- GENERAL UI --- */
.pf{font-family:'Playfair Display',serif}
.screen{flex:1;overflow-y:auto;padding-bottom:90px}
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(22,22,22,0.97);backdrop-filter:blur(20px);border-top:1px solid ${C.border};display:flex;padding:10px 0 20px;z-index:100}
.ni{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;flex:1;transition:all .2s}
.ni.act .nicon{transform:scale(1.15)}
.nicon{font-size:20px;line-height:1}
.nlbl{font-size:9px;font-weight:600;letter-spacing:.5px;text-transform:uppercase}
.btn{border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;transition:all .18s;border-radius:12px}
.bg{background:linear-gradient(135deg,${C.gold},${C.goldLight});color:#0D0D0D;padding:14px 24px;font-size:15px;width:100%}
.bg:active{transform:scale(.98);opacity:.9}
.bg:disabled{opacity:.4;cursor:not-allowed}
.bo{background:transparent;border:1px solid ${C.border};color:${C.text};padding:12px 20px;font-size:14px;border-radius:12px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600}
.bgh{background:transparent;color:${C.gold};padding:8px 14px;font-size:13px;border:1px solid ${C.goldDim};border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600}
.bdgr{background:rgba(224,82,82,.15);border:1px solid rgba(224,82,82,.3);color:${C.red};padding:8px 14px;font-size:13px;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif}
.badge{display:inline-block;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600}
.bgold{background:rgba(201,168,76,.15);color:${C.gold}}
.bgrn{background:rgba(76,175,122,.15);color:${C.green}}
.bred{background:rgba(224,82,82,.15);color:${C.red}}
.bblu{background:rgba(91,156,246,.15);color:${C.blue}}
.bpur{background:rgba(167,139,250,.15);color:${C.purple}}
.borg{background:rgba(245,158,11,.15);color:${C.orange}}
.bpnk{background:rgba(244,114,182,.15);color:${C.pink}}
.card{background:${C.card};border-radius:16px;padding:18px;border:1px solid ${C.border}}
.hdr{padding:20px 20px 0}
.sec{padding:0 20px;margin-top:20px}
.stit{font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};margin-bottom:12px}
.inp{background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:13px 16px;color:${C.text};font-family:'DM Sans',sans-serif;font-size:14px;width:100%;outline:none;transition:border-color .2s}
.inp:focus{border-color:${C.gold}}
.inp::placeholder{color:${C.dim}}
.lbl{font-size:12px;font-weight:500;color:${C.muted};margin-bottom:6px;display:block}
.sel{background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:13px 16px;color:${C.text};font-family:'DM Sans',sans-serif;font-size:14px;width:100%;outline:none}
.txa{background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:13px 16px;color:${C.text};font-family:'DM Sans',sans-serif;font-size:14px;width:100%;outline:none;resize:none;min-height:90px}
.ov{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:200;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(6px)}
.mod{background:${C.surface};border-radius:24px 24px 0 0;padding:24px 20px 44px;width:100%;max-width:430px;border-top:1px solid ${C.border};animation:su .3s ease;max-height:92vh;overflow-y:auto}
.modfull{position:fixed;inset:0;background:${C.bg};z-index:300;overflow-y:auto;animation:fi .25s ease;max-width:430px;left:50%;transform:translateX(-50%)}
@keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes fi{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.mh{width:40px;height:4px;background:${C.border};border-radius:2px;margin:0 auto 20px}
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sc{background:${C.card};border-radius:14px;padding:16px;border:1px solid ${C.border}}
.aprow{display:flex;align-items:center;gap:14px;padding:14px;background:${C.card};border-radius:14px;border:1px solid ${C.border};margin-bottom:10px;cursor:pointer;transition:border-color .2s}
.aprow:active{border-color:${C.gold}}
.tslot{background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:10px;text-align:center;cursor:pointer;transition:all .18s;font-size:13px;font-weight:500}
.tslot.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}
.tslot.taken{opacity:.35;cursor:not-allowed}
.trow{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid ${C.border}}
.tgl{width:48px;height:26px;background:${C.border};border-radius:13px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.tgl.on{background:${C.gold}}
.tth{width:20px;height:20px;background:white;border-radius:50%;position:absolute;top:3px;left:3px;transition:left .2s}
.tgl.on .tth{left:25px}
.txrow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid ${C.border}}
.ptabs{display:flex;background:${C.surface};border-radius:12px;padding:4px;gap:4px}
.ptab{flex:1;padding:8px;text-align:center;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;color:${C.muted}}
.ptab.act{background:${C.card};color:${C.gold}}
.qgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.qa{background:${C.card};border-radius:14px;padding:14px 8px;text-align:center;cursor:pointer;border:1px solid ${C.border};transition:all .18s}
.qa:active{transform:scale(.95);border-color:${C.gold}}
.fab{position:fixed;bottom:100px;right:20px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,${C.gold},${C.goldLight});border:none;font-size:26px;cursor:pointer;box-shadow:0 4px 24px rgba(201,168,76,.45);z-index:90;display:flex;align-items:center;justify-content:center;transition:transform .2s}
.fab:active{transform:scale(.92)}
.pav{border-radius:50%;background:linear-gradient(135deg,${C.gold},${C.goldDim});display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:#0D0D0D}
.bar{border-radius:6px 6px 0 0;background:linear-gradient(180deg,${C.gold},${C.goldDim})}
.bar.dim{background:${C.card}}
.mtag{display:inline-block;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);border-radius:6px;padding:4px 10px;font-size:11px;color:${C.gold};margin-right:8px;white-space:nowrap;cursor:pointer}
.pb{height:4px;background:${C.border};border-radius:2px;overflow:hidden}
.pbf{height:100%;background:linear-gradient(90deg,${C.gold},${C.goldLight});border-radius:2px}
.notif-dot{position:absolute;top:-2px;right:-2px;width:8px;height:8px;background:${C.red};border-radius:50%;border:2px solid ${C.bg}}
.loyalty-ring{position:relative;width:110px;height:110px;flex-shrink:0}
.loyalty-ring svg{transform:rotate(-90deg)}
.gc-card{border-radius:18px;padding:22px;position:relative;overflow:hidden;min-height:140px;display:flex;flex-direction:column;justify-content:space-between}
.gc-shine{position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.07)}
.admin-metric{background:${C.card};border-radius:14px;padding:14px;border:1px solid ${C.border};position:relative;overflow:hidden}
.admin-metric::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;border-radius:0 0 14px 14px}
.spark{display:flex;align-items:flex-end;gap:3px;height:32px}
.spark-bar{border-radius:3px 3px 0 0;background:rgba(201,168,76,.4);min-width:6px;transition:height .4s}
.client-row{display:flex;align-items:center;gap:12px;padding:12px 14px;background:${C.card};border-radius:14px;border:1px solid ${C.border};margin-bottom:8px;cursor:pointer;transition:border-color .2s}
.client-row:active{border-color:${C.gold}}

/* Notification toast */
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${C.card};border:1px solid ${C.gold};border-radius:14px;padding:12px 20px;font-size:13px;font-weight:600;color:${C.gold};z-index:999;animation:toastIn .3s ease,toastOut .3s 2.2s ease forwards;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.4)}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes toastOut{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(-12px)}}

/* Input with icon */
.inp-wrap{position:relative}
.inp-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:16px;pointer-events:none}
.inp-pad{padding-left:42px}

/* Floating label effect */
.fl-group{position:relative;margin-bottom:16px}
.fl-inp{background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:20px 16px 8px;color:${C.text};font-family:'DM Sans',sans-serif;font-size:14px;width:100%;outline:none;transition:border-color .2s}
.fl-inp:focus{border-color:${C.gold}}
.fl-lbl{position:absolute;left:16px;top:14px;font-size:14px;color:${C.dim};transition:all .18s;pointer-events:none}
.fl-inp:focus ~ .fl-lbl,.fl-inp:not(:placeholder-shown) ~ .fl-lbl{top:7px;font-size:10px;font-weight:600;letter-spacing:.5px;color:${C.gold};text-transform:uppercase}
.fl-inp::placeholder{color:transparent}

::-webkit-scrollbar{width:0}

/* --- CALENDAR --- */
.cal-wrap{display:flex;flex-direction:column;height:calc(100vh - 180px);overflow:hidden}
.cal-header{display:grid;gap:1px;background:${C.border};flex-shrink:0}
.cal-col-hdr{background:${C.surface};padding:8px 4px;text-align:center;font-size:11px;font-weight:700;letter-spacing:.5px}
.cal-col-hdr.today{background:rgba(201,168,76,.12);color:${C.gold}}
.cal-body{display:flex;flex:1;overflow:hidden}
.cal-time-col{flex-shrink:0;width:44px;overflow-y:auto;background:${C.bg};scrollbar-width:none}
.cal-time-col::-webkit-scrollbar{display:none}
.cal-time-label{height:48px;display:flex;align-items:flex-start;justify-content:flex-end;padding:4px 6px 0 0;font-size:9px;color:${C.dim};font-weight:600;flex-shrink:0}
.cal-grid-area{flex:1;overflow:auto;position:relative;scrollbar-width:none}
.cal-grid-area::-webkit-scrollbar{display:none}
.cal-day-cols{display:grid;min-height:960px;position:relative}
.cal-row-line{position:absolute;left:0;right:0;height:1px;background:${C.border};opacity:.4}
.cal-row-line.hour{opacity:.7}
.cal-event{position:absolute;border-radius:8px;padding:4px 6px;cursor:pointer;overflow:hidden;transition:transform .1s,box-shadow .1s;border-left:3px solid;z-index:2}
.cal-event:active{transform:scale(.97);box-shadow:0 4px 16px rgba(0,0,0,.4)}
.cal-day-col{position:relative;border-right:1px solid ${C.border};min-width:0}
.cal-now-line{position:absolute;left:0;right:0;height:2px;background:${C.red};z-index:5;border-radius:1px}
.cal-now-line::before{content:'';position:absolute;left:-5px;top:-4px;width:10px;height:10px;background:${C.red};border-radius:50%}
.cal-week-nav{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;flex-shrink:0}
.cal-week-btn{width:32px;height:32px;border-radius:50%;border:1px solid ${C.border};background:${C.card};color:${C.text};font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:'DM Sans',sans-serif}
.cal-barber-tab{padding:6px 14px;border-radius:20px;border:1px solid ${C.border};background:${C.surface};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap;flex-shrink:0}
.cal-barber-tab.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}

/* --- REVIEWS --- */
.review-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;transition:border-color .2s}
.review-card:active{border-color:${C.gold}}
.star-row{display:flex;gap:2px;align-items:center}
.star{font-size:14px;cursor:pointer;transition:transform .1s}
.star:active{transform:scale(1.3)}
.rating-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.rating-bar-bg{flex:1;height:6px;background:${C.border};border-radius:3px;overflow:hidden}
.rating-bar-fill{height:100%;background:linear-gradient(90deg,${C.gold},${C.goldLight});border-radius:3px;transition:width .5s ease}
.reply-bubble{background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2);border-radius:0 12px 12px 12px;padding:10px 12px;margin-top:8px;position:relative}
.reply-bubble::before{content:'';position:absolute;top:-1px;left:-1px;width:0;height:0;border-left:1px solid rgba(201,168,76,.2);border-top:1px solid rgba(201,168,76,.2);border-radius:0 0 0 8px}
.review-req-card{background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(201,168,76,.04));border:1px solid rgba(201,168,76,.25);border-radius:16px;padding:16px;margin-bottom:14px}
.platform-star{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid ${C.border}}

/* --- STRIPE --- */
.stripe-hero{background:linear-gradient(135deg,#635BFF18,#635BFF06);border:1px solid #635BFF33;border-radius:18px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden}
.stripe-hero::after{content:'';position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#635BFF22,transparent)}
.reader-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:border-color .2s;position:relative;overflow:hidden}
.reader-card.connected{border-color:rgba(76,175,122,.35)}
.reader-card.pairing{border-color:rgba(245,158,11,.35)}
.reader-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.reader-status-dot.connected{background:${C.green};box-shadow:0 0 6px ${C.green}}
.reader-status-dot.pairing{background:${C.orange};animation:alertPulse 1.5s infinite}
.reader-status-dot.offline{background:${C.dim}}
.payout-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid ${C.border}}
.bank-card{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:12px}
.bank-icon{width:44px;height:44px;border-radius:12px;background:rgba(91,156,246,.12);border:1px solid rgba(91,156,246,.25);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.fee-breakdown{background:${C.surface};border-radius:12px;padding:14px;margin-top:10px}
.stripe-stat{background:${C.card};border-radius:14px;padding:14px;border:1px solid ${C.border};text-align:center;flex:1}
.stripe-connect-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;background:linear-gradient(135deg,#635BFF,#7B73FF);border:none;border-radius:12px;color:white;font-size:15px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer;width:100%;margin-bottom:12px;transition:opacity .2s}
.stripe-connect-btn:active{opacity:.85}

/* --- BOOKING POLISH / SMS --- */
.sms-thread{display:flex;flex-direction:column;gap:10px;padding:16px 0}
.sms-msg{max-width:78%;border-radius:18px;padding:10px 14px;font-size:13px;line-height:1.5}
.sms-msg.out{align-self:flex-end;background:linear-gradient(135deg,${C.gold},${C.goldLight});color:#0D0D0D;border-radius:18px 18px 4px 18px}
.sms-msg.in{align-self:flex-start;background:${C.card};border:1px solid ${C.border};border-radius:18px 18px 18px 4px}
.sms-time{font-size:10px;color:${C.dim};text-align:center;margin:4px 0}
.confirm-card{background:linear-gradient(135deg,rgba(76,175,122,.12),rgba(76,175,122,.04));border:1px solid rgba(76,175,122,.3);border-radius:18px;padding:20px;margin-bottom:16px}
.remind-chip{padding:8px 16px;border-radius:10px;border:1px solid ${C.border};background:${C.card};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;text-align:center}
.remind-chip.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}
.booking-step-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
.booking-step-line{width:2px;height:24px;margin:2px auto;background:${C.border}}
.booking-timeline{background:${C.card};border-radius:16px;padding:16px;margin-bottom:14px;border:1px solid ${C.border}}

/* --- SERVICE MENU BUILDER --- */
.svc-builder-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;position:relative;overflow:hidden;transition:border-color .2s}
.svc-builder-card:active{border-color:${C.gold}}
.svc-builder-card.featured{border-color:rgba(201,168,76,.4);background:rgba(201,168,76,.04)}
.svc-cat-chip{padding:7px 14px;border-radius:20px;border:1px solid ${C.border};background:${C.surface};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap}
.svc-cat-chip.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}
.add-on-tag{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;background:rgba(91,156,246,.1);border:1px solid rgba(91,156,246,.25);color:${C.blue};font-size:11px;font-weight:600;cursor:pointer;margin-right:6px;margin-bottom:6px}
.dur-chip{padding:7px 12px;border-radius:10px;border:1px solid ${C.border};background:${C.surface};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s}
.dur-chip.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}

/* --- REFERRAL PROGRAM --- */
.ref-code-card{background:linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06));border:2px solid rgba(201,168,76,.35);border-radius:20px;padding:24px;text-align:center;margin-bottom:16px;position:relative;overflow:hidden}
.ref-code-card::before{content:'✂️';position:absolute;right:-10px;top:-10px;font-size:80px;opacity:.06}
.ref-code{font-family:monospace;font-size:28px;font-weight:900;color:${C.gold};letter-spacing:6px;margin:12px 0}
.ref-link-row{display:flex;align-items:center;background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:10px 14px;margin-bottom:14px;gap:8px}
.ref-person-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid ${C.border}}
.ref-stage-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.ref-stage-dot.signed-up{background:${C.orange}}
.ref-stage-dot.visited{background:${C.blue}}
.ref-stage-dot.rewarded{background:${C.green};box-shadow:0 0 6px ${C.green}}

/* --- AI REVENUE FORECASTING --- */
.forecast-hero{background:linear-gradient(135deg,rgba(167,139,250,.15),rgba(167,139,250,.04));border:1px solid rgba(167,139,250,.3);border-radius:20px;padding:22px;margin-bottom:16px;position:relative;overflow:hidden}
.forecast-hero::after{content:'🤖';position:absolute;right:16px;top:16px;font-size:44px;opacity:.15}
.forecast-bar-wrap{display:flex;align-items:flex-end;gap:4px;height:80px;margin:12px 0}
.forecast-bar{border-radius:4px 4px 0 0;flex:1;transition:height .5s ease;min-width:8px}
.forecast-bar.actual{background:linear-gradient(180deg,${C.gold},${C.goldDim})}
.forecast-bar.projected{background:linear-gradient(180deg,rgba(167,139,250,.8),rgba(167,139,250,.3));border-top:2px dashed rgba(167,139,250,.7)}
.goal-card{background:${C.card};border-radius:16px;padding:16px;border:1px solid ${C.border};margin-bottom:10px;position:relative;overflow:hidden}
.goal-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;border-radius:0 0 16px 16px}
.goal-card.on-track::after{background:${C.green}}
.goal-card.behind::after{background:${C.orange}}
.goal-card.exceeded::after{background:${C.gold}}
.ai-insight-card{background:linear-gradient(135deg,rgba(167,139,250,.1),rgba(167,139,250,.03));border:1px solid rgba(167,139,250,.2);border-radius:14px;padding:14px;margin-bottom:10px;display:flex;gap:10px}
.insight-icon-wrap{width:36px;height:36px;border-radius:10px;background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.25);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}

/* --- DAILY CASH-OUT --- */
.cashout-hero{background:linear-gradient(135deg,rgba(76,175,122,.15),rgba(76,175,122,.04));border:1px solid rgba(76,175,122,.3);border-radius:20px;padding:22px;margin-bottom:16px;text-align:center;position:relative;overflow:hidden}
.cashout-hero::before{content:'💵';position:absolute;right:14px;top:14px;font-size:52px;opacity:.12}
.denomination-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid ${C.border}}
.denom-qty-btn{width:30px;height:30px;border-radius:8px;border:1px solid ${C.border};background:${C.surface};color:${C.text};font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:'DM Sans',sans-serif}
.discrepancy-banner{border-radius:12px;padding:12px 14px;margin-bottom:12px;display:flex;gap:10px;align-items:center}
.discrepancy-banner.ok{background:rgba(76,175,122,.1);border:1px solid rgba(76,175,122,.25)}
.discrepancy-banner.warn{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25)}
.discrepancy-banner.err{background:rgba(224,82,82,.1);border:1px solid rgba(224,82,82,.25)}
.eod-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid ${C.border}}

/* --- WALK-IN KIOSK --- */
.kiosk-wrap{background:#0A0A0A;position:fixed;inset:0;z-index:400;display:flex;flex-direction:column;max-width:430px;left:50%;transform:translateX(-50%);overflow-y:auto}
.kiosk-hero{background:linear-gradient(180deg,rgba(201,168,76,.22),transparent);padding:36px 24px 24px;text-align:center}
.kiosk-barber-card{background:${C.card};border:2px solid ${C.border};border-radius:20px;padding:18px;cursor:pointer;transition:all .2s;text-align:center}
.kiosk-barber-card.sel{border-color:${C.gold};background:rgba(201,168,76,.06);transform:scale(1.02)}
.kiosk-barber-card:active{transform:scale(.97)}
.kiosk-queue-row{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;position:relative;overflow:hidden}
.kiosk-queue-row.current{border-color:rgba(76,175,122,.45);background:rgba(76,175,122,.07)}
.kiosk-queue-row.next-up{border-color:rgba(201,168,76,.35)}
.kiosk-num{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;font-family:'Playfair Display',serif;flex-shrink:0}
.kiosk-ticket{background:linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06));border:2px dashed rgba(201,168,76,.4);border-radius:20px;padding:28px 24px;margin:20px;text-align:center}
.kiosk-ticket-num{font-size:72px;font-weight:900;font-family:'Playfair Display',serif;color:${C.gold};line-height:1}

/* --- PHOTO PORTFOLIO --- */
.portfolio-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px}
.portfolio-item{aspect-ratio:1;background:${C.card};border-radius:4px;overflow:hidden;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;transition:opacity .2s}
.portfolio-item:active{opacity:.7}
.portfolio-item-emoji{font-size:36px;opacity:.55}
.photo-tag{display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-right:6px;margin-bottom:6px;cursor:pointer;border:1px solid ${C.border};background:${C.surface};color:${C.muted};transition:all .18s}
.photo-tag.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}
.bp-avatar{width:48px;height:48px;border-radius:50%;border:2px solid transparent;transition:border-color .18s;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700}
.barber-portfolio-tab{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;flex-shrink:0}
.barber-portfolio-tab.sel .bp-avatar{border-color:${C.gold}}
.portfolio-photo-full{position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:500;display:flex;flex-direction:column;max-width:430px;left:50%;transform:translateX(-50%);padding:20px}
.ba-panel{background:${C.card};border-radius:12px;padding:14px;text-align:center;position:relative;overflow:hidden;flex:1}

/* --- PAYROLL & COMMISSION --- */
.payroll-barber-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:border-color .2s}
.payroll-barber-card:active{border-color:${C.gold}}
.payroll-barber-card.sel{border-color:rgba(201,168,76,.5);background:rgba(201,168,76,.04)}
.commission-bar{height:8px;border-radius:4px;background:${C.border};overflow:hidden;margin-top:6px}
.commission-fill{height:100%;border-radius:4px;transition:width .6s ease}
.pay-stub{background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:16px;margin-bottom:10px;position:relative;overflow:hidden}
.pay-stub::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:14px 0 0 14px}
.pay-stub.paid::before{background:${C.green}}
.pay-stub.pending::before{background:${C.orange}}
.split-slider{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:2px;background:${C.border};outline:none;cursor:pointer;margin:12px 0}
.split-slider::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:${C.gold};cursor:pointer;box-shadow:0 2px 8px rgba(201,168,76,.4)}
.earnings-ring{position:relative;display:flex;align-items:center;justify-content:center}

/* --- TIP SPLITTING --- */
.tip-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px}
.tip-barber-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid ${C.border}}
.tip-amount-pill{background:rgba(76,175,122,.12);border:1px solid rgba(76,175,122,.25);border-radius:20px;padding:4px 12px;font-size:13px;font-weight:700;color:${C.green}}
.tip-method-btn{flex:1;padding:10px;text-align:center;border-radius:10px;border:1px solid ${C.border};background:${C.surface};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s}
.tip-method-btn.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}
.tip-history-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid ${C.border}}

/* --- TAX & EXPENSE TRACKER --- */
.expense-card{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;margin-bottom:8px;display:flex;gap:12px;align-items:center;cursor:pointer;transition:border-color .2s}
.expense-card:active{border-color:${C.gold}}
.expense-icon-wrap{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.tax-estimate-card{background:linear-gradient(135deg,rgba(224,82,82,.12),rgba(224,82,82,.04));border:1px solid rgba(224,82,82,.25);border-radius:18px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden}
.tax-estimate-card::after{content:'🏛';position:absolute;right:14px;top:14px;font-size:40px;opacity:.15}
.category-pill{display:inline-block;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-right:6px;margin-bottom:6px;cursor:pointer;border:1px solid transparent;transition:all .18s}
.quarter-tab{flex:1;padding:9px 6px;text-align:center;border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;color:${C.muted}}
.quarter-tab.act{background:${C.card};color:${C.gold}}

/* --- SUPPLY REORDER --- */
.reorder-card{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;margin-bottom:8px;position:relative;overflow:hidden;transition:border-color .2s}
.reorder-card.urgent{border-color:rgba(224,82,82,.4);background:rgba(224,82,82,.03)}
.reorder-card.soon{border-color:rgba(245,158,11,.35)}
.reorder-card.ok{border-color:rgba(76,175,122,.25)}
.vendor-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid ${C.border}}
.po-card{background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:14px;margin-bottom:10px}
.po-status{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700}
.po-status.ordered{background:rgba(91,156,246,.12);color:${C.blue};border:1px solid rgba(91,156,246,.25)}
.po-status.delivered{background:rgba(76,175,122,.12);color:${C.green};border:1px solid rgba(76,175,122,.25)}
.po-status.pending{background:rgba(245,158,11,.12);color:${C.orange};border:1px solid rgba(245,158,11,.25)}
.reorder-qty-btn{width:28px;height:28px;border-radius:8px;border:1px solid ${C.border};background:${C.surface};color:${C.text};font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:'DM Sans',sans-serif}

/* --- CLIENT CHECK-IN FLOW --- */
.checkin-wrap{position:fixed;inset:0;background:${C.bg};z-index:400;display:flex;flex-direction:column;max-width:430px;left:50%;transform:translateX(-50%);overflow-y:auto}
.checkin-hero{background:linear-gradient(160deg,rgba(201,168,76,.2),rgba(201,168,76,.05) 70%,${C.bg});padding:36px 24px 24px;position:relative;overflow:hidden}
.checkin-client-card{background:${C.card};border:2px solid ${C.border};border-radius:18px;padding:16px;margin-bottom:10px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:14px}
.checkin-client-card.sel{border-color:${C.gold};background:rgba(201,168,76,.06)}
.checkin-client-card:active{transform:scale(.98)}
.checkin-status{display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 0;text-align:center}
.checkin-done-ring{width:100px;height:100px;border-radius:50%;border:3px solid ${C.green};display:flex;align-items:center;justify-content:center;font-size:48px;background:rgba(76,175,122,.08);animation:bounce .8s ease}
.consult-q{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;margin-bottom:10px}

/* --- RECURRING APPTS MANAGER --- */
.recur-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;position:relative;overflow:hidden;transition:border-color .2s}
.recur-card:active{border-color:${C.gold}}
.recur-card.paused{opacity:.65;border-style:dashed}
.recur-freq-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700}
.recur-freq-badge.weekly{background:rgba(91,156,246,.12);color:${C.blue};border:1px solid rgba(91,156,246,.25)}
.recur-freq-badge.biweekly{background:rgba(201,168,76,.12);color:${C.gold};border:1px solid rgba(201,168,76,.25)}
.recur-freq-badge.monthly{background:rgba(167,139,250,.12);color:${C.purple};border:1px solid rgba(167,139,250,.25)}
.recur-timeline{display:flex;gap:6px;overflow-x:auto;padding:8px 0 4px;scrollbar-width:none}
.recur-timeline::-webkit-scrollbar{display:none}
.recur-date-dot{display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0}
.recur-dot{width:10px;height:10px;border-radius:50%}
.recur-dot.past{background:${C.gold}}
.recur-dot.upcoming{background:${C.blue};box-shadow:0 0 6px ${C.blue}}
.recur-dot.missed{background:${C.red}}

/* --- EQUIPMENT MAINTENANCE --- */
.equip-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:border-color .2s;position:relative;overflow:hidden}
.equip-card:active{border-color:${C.gold}}
.equip-card.due{border-color:rgba(224,82,82,.4);background:rgba(224,82,82,.03)}
.equip-card.upcoming{border-color:rgba(245,158,11,.35)}
.equip-card.ok{border-color:rgba(76,175,122,.2)}
.maint-log-row{display:flex;gap:10px;padding:11px 0;border-bottom:1px solid ${C.border}}
.maint-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:4px}
.health-ring{position:relative;width:64px;height:64px;flex-shrink:0}
.health-ring svg{transform:rotate(-90deg)}

/* --- TIME CLOCK / SHIFTS --- */
.timeclock-hero{background:linear-gradient(135deg,rgba(91,156,246,.14),rgba(91,156,246,.04));border:1px solid rgba(91,156,246,.3);border-radius:20px;padding:22px;margin-bottom:16px;text-align:center;position:relative;overflow:hidden}
.timeclock-hero::after{content:'⏰';position:absolute;right:14px;top:14px;font-size:48px;opacity:.12}
.clock-display{font-size:52px;font-weight:900;font-family:'Playfair Display',serif;color:${C.blue};letter-spacing:2px;line-height:1;margin:10px 0}
.clock-btn{padding:16px 32px;border-radius:16px;font-size:16px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;transition:all .2s;width:100%}
.clock-btn.in{background:linear-gradient(135deg,${C.green},#2E7D54);color:white;box-shadow:0 4px 20px rgba(76,175,122,.4)}
.clock-btn.out{background:linear-gradient(135deg,${C.red},#A33030);color:white;box-shadow:0 4px 20px rgba(224,82,82,.4)}
.clock-btn:active{transform:scale(.97)}
.shift-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid ${C.border}}
.shift-bar-wrap{display:flex;align-items:center;gap:6px;flex:1}
.shift-bar{height:6px;border-radius:3px;background:${C.border};overflow:hidden;flex:1}
.shift-bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,${C.blue},${C.purple})}
.staff-clock-row{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;margin-bottom:8px;display:flex;gap:12px;align-items:center}
.staff-clock-row.clocked-in{border-color:rgba(76,175,122,.35)}
.clock-status-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.clock-status-dot.in{background:${C.green};box-shadow:0 0 6px ${C.green}}
.clock-status-dot.out{background:${C.dim}}

/* --- SUBSCRIPTION MANAGEMENT --- */
.sub-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:600;display:flex;align-items:flex-end;justify-content:center;max-width:430px;left:50%;transform:translateX(-50%)}
.sub-sheet{background:${C.surface};border-radius:24px 24px 0 0;border-top:1px solid ${C.border};padding:0 0 40px;width:100%;max-height:92vh;overflow-y:auto;animation:sheetUp .35s cubic-bezier(.16,1,.3,1)}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.plan-card{border:2px solid ${C.border};border-radius:18px;padding:18px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
.plan-card.current{border-color:${C.gold};background:rgba(201,168,76,.05)}
.plan-card.highlight{border-color:${C.purple};background:rgba(167,139,250,.05)}
.plan-card:active{transform:scale(.98)}
.plan-popular{position:absolute;top:0;right:0;background:${C.purple};color:white;font-size:9px;font-weight:800;padding:"4px 10px";border-radius:"0 18px 0 10px";letter-spacing:.5}
.invoice-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid ${C.border}}
.cancel-step{display:flex;flex-direction:column;align-items:center;text-align:center;padding:20px 0}
.feature-row{display:flex;align-items:center;gap:10px;padding:7px 0}
.feature-row .check{width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
.feature-row .check.yes{background:rgba(76,175,122,.15);color:${C.green}}
.feature-row .check.no{background:rgba(255,255,255,.05);color:${C.dim}}
.payment-method-card{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;margin-bottom:10px;cursor:pointer;transition:border-color .2s}
.payment-method-card.sel{border-color:${C.gold}}

/* --- IN-APP CHAT --- */
.chat-wrap{position:fixed;inset:0;background:${C.bg};z-index:400;display:flex;flex-direction:column;max-width:430px;left:50%;transform:translateX(-50%)}
.chat-header{padding:14px 20px;border-bottom:1px solid ${C.border};display:flex;align-items:center;gap:12px;background:${C.surface};flex-shrink:0}
.chat-thread{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px}
.chat-bubble{max-width:80%;border-radius:18px;padding:10px 14px;font-size:13px;line-height:1.5;word-break:break-word}
.chat-bubble.out{align-self:flex-end;background:linear-gradient(135deg,${C.gold},${C.goldLight});color:#0D0D0D;border-radius:18px 18px 4px 18px}
.chat-bubble.in{align-self:flex-start;background:${C.card};border:1px solid ${C.border};border-radius:18px 18px 18px 4px}
.chat-bubble.system{align-self:center;background:transparent;color:${C.dim};font-size:11px;text-align:center;padding:4px 8px}
.chat-input-row{padding:12px 16px;border-top:1px solid ${C.border};display:flex;gap:10px;align-items:flex-end;background:${C.surface};flex-shrink:0}
.chat-input{flex:1;background:${C.card};border:1px solid ${C.border};border-radius:22px;padding:10px 16px;color:${C.text};font-family:'DM Sans',sans-serif;font-size:14px;outline:none;resize:none;max-height:100px;line-height:1.4}
.chat-input:focus{border-color:${C.gold}}
.chat-send-btn{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,${C.gold},${C.goldLight});border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;transition:transform .15s}
.chat-send-btn:active{transform:scale(.92)}
.chat-list-item{display:flex;gap:12px;padding:14px 20px;cursor:pointer;transition:background .15s;border-bottom:1px solid ${C.border};position:relative}
.chat-list-item:active{background:rgba(255,255,255,.03)}
.chat-unread-dot{width:10px;height:10px;border-radius:50%;background:${C.gold};flex-shrink:0;margin-top:4px}
.chat-unread-count{position:absolute;top:12px;right:20px;background:${C.gold};color:#0D0D0D;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px}
.online-dot{width:10px;height:10px;border-radius:50%;background:${C.green};border:2px solid ${C.surface};position:absolute;bottom:0;right:0;box-shadow:0 0 6px ${C.green}}

/* --- DEPOSIT & PREPAYMENT --- */
.deposit-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:border-color .2s}
.deposit-card:active{border-color:${C.gold}}
.deposit-card.pending{border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.04)}
.deposit-card.paid{border-color:rgba(76,175,122,.3)}
.deposit-card.refunded{border-color:rgba(91,156,246,.3)}
.deposit-amount-ring{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex-shrink:0;border:2px solid}
.deposit-amount-ring.pending{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.4);color:${C.orange}}
.deposit-amount-ring.paid{background:rgba(76,175,122,.1);border-color:rgba(76,175,122,.3);color:${C.green}}
.prepay-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid ${C.border}}
.pct-chip{padding:8px 14px;border-radius:10px;border:1px solid ${C.border};background:${C.surface};font-size:13px;font-weight:700;cursor:pointer;transition:all .18s}
.pct-chip.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}

/* --- DAILY BRIEFING --- */
.briefing-wrap{position:fixed;inset:0;background:${C.bg};z-index:450;display:flex;flex-direction:column;max-width:430px;left:50%;transform:translateX(-50%);overflow-y:auto}
.briefing-hero{background:linear-gradient(160deg,rgba(201,168,76,.18),rgba(201,168,76,.05) 60%,${C.bg});padding:48px 24px 28px;position:relative;overflow:hidden}
.briefing-hero::before{content:'';position:absolute;top:-80px;right:-60px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,.15),transparent 70%);pointer-events:none}
.briefing-stat-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;flex:1;text-align:center}
.briefing-appt-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid ${C.border}}
.briefing-action-card{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:center;cursor:pointer;transition:border-color .2s}
.briefing-action-card:active{border-color:${C.gold}}
.weather-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(91,156,246,.1);border:1px solid rgba(91,156,246,.2);border-radius:20px;padding:4px 12px;font-size:12px;color:${C.blue}}

/* --- STAFF PERFORMANCE SCORECARDS --- */
.scorecard-hero{background:linear-gradient(135deg,rgba(167,139,250,.14),rgba(167,139,250,.04));border:1px solid rgba(167,139,250,.3);border-radius:20px;padding:20px;margin-bottom:16px}
.kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.kpi-card{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;text-align:center}
.kpi-card.highlight{border-color:${C.gold};background:rgba(201,168,76,.04)}
.rank-badge{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}
.rank-badge.r1{background:linear-gradient(135deg,${C.gold},${C.goldLight});color:#0D0D0D}
.rank-badge.r2{background:rgba(224,224,224,.15);color:#ddd}
.rank-badge.r3{background:rgba(205,127,50,.2);color:#CD7F32}
.score-meter{height:6px;background:${C.border};border-radius:3px;overflow:hidden;margin-top:6px}
.score-fill{height:100%;border-radius:3px;transition:width .6s ease}
.trend-up{color:${C.green};font-size:11px;font-weight:700}
.trend-down{color:${C.red};font-size:11px;font-weight:700}
.trend-flat{color:${C.muted};font-size:11px;font-weight:700}

/* --- EMAIL CAMPAIGN BUILDER --- */
.campaign-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:border-color .2s;position:relative;overflow:hidden}
.campaign-card:active{border-color:${C.gold}}
.campaign-card.active-camp{border-color:rgba(76,175,122,.4)}
.campaign-card.draft{border-color:rgba(245,158,11,.3)}
.campaign-card.sent{border-color:rgba(91,156,246,.25)}
.email-template-card{background:${C.surface};border:2px solid ${C.border};border-radius:14px;padding:16px;cursor:pointer;transition:all .2s}
.email-template-card.sel{border-color:${C.gold};background:rgba(201,168,76,.04)}
.email-template-card:active{transform:scale(.98)}
.segment-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;margin-right:6px;margin-bottom:6px;border:1px solid ${C.border};background:${C.surface};color:${C.muted};transition:all .18s}
.segment-chip.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}
.stat-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700}
.stat-pill.open{background:rgba(76,175,122,.12);color:${C.green}}
.stat-pill.click{background:rgba(91,156,246,.12);color:${C.blue}}
.stat-pill.unsub{background:rgba(224,82,82,.1);color:${C.red}}

/* --- DATA EXPORT CENTER --- */
.export-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:all .2s;display:flex;gap:14px;align-items:center}
.export-card:active{border-color:${C.gold};transform:scale(.98)}
.export-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
.export-progress{height:3px;background:${C.border};border-radius:2px;overflow:hidden;margin-top:8px}
.export-progress-fill{height:100%;background:linear-gradient(90deg,${C.gold},${C.green});border-radius:2px;transition:width .4s ease}
.format-chip{padding:7px 14px;border-radius:20px;border:1px solid ${C.border};background:${C.surface};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s}
.format-chip.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}

/* --- V12 FRANCHISE DASHBOARD --- */
.loc-card{background:${C.card};border:1px solid ${C.border};border-radius:18px;padding:18px;margin-bottom:12px;transition:all .2s;cursor:pointer;position:relative;overflow:hidden}
.loc-card:active{transform:scale(.98);border-color:${C.gold}}
.loc-card.active{border-color:${C.gold}44;background:rgba(201,168,76,.04)}
.loc-status{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.loc-status.open{background:${C.green};box-shadow:0 0 8px ${C.green}60}
.loc-status.closed{background:${C.red}}
.franchise-stat{background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:14px;flex:1;text-align:center}
.network-banner{background:linear-gradient(135deg,rgba(201,168,76,.15),rgba(167,139,250,.1));border:1px solid rgba(201,168,76,.25);border-radius:16px;padding:16px;margin-bottom:16px}

/* --- V12 REFUND MANAGEMENT --- */
.refund-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:all .2s}
.refund-card:active{border-color:${C.red}66}
.refund-status{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.refund-status.pending{background:rgba(245,158,11,.15);color:${C.orange}}
.refund-status.approved{background:rgba(76,175,122,.15);color:${C.green}}
.refund-status.denied{background:rgba(224,82,82,.15);color:${C.red}}
.refund-status.processing{background:rgba(91,156,246,.15);color:${C.blue}}

/* --- V12 QR CODE GENERATOR --- */
.qr-box{background:white;border-radius:20px;padding:20px;display:flex;align-items:center;justify-content:center;margin:0 auto}
.qr-type-btn{flex:1;padding:10px;border-radius:12px;border:1px solid ${C.border};background:${C.surface};font-size:12px;font-weight:600;color:${C.muted};cursor:pointer;transition:all .2s;text-align:center}
.qr-type-btn.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}
.qr-action-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px;background:${C.card};border:1px solid ${C.border};border-radius:14px;cursor:pointer;transition:all .2s;font-size:12px;font-weight:600}
.qr-action-btn:active{border-color:${C.gold};transform:scale(.97)}

/* --- V12 REPORT BUILDER --- */
.metric-pill{padding:8px 14px;border-radius:20px;border:1px solid ${C.border};background:${C.surface};font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;white-space:nowrap}
.metric-pill.sel{border-color:${C.gold};background:rgba(201,168,76,.12);color:${C.gold}}
.report-bar{display:flex;align-items:flex-end;gap:6px;height:80px;padding:0 4px}
.report-bar-col{flex:1;border-radius:4px 4px 0 0;min-width:14px;transition:all .3s;cursor:pointer}
.report-bar-col:hover{filter:brightness(1.2)}

/* --- V12 LOYALTY WALLET --- */
.wallet-card{background:linear-gradient(135deg,#1a1408,#241c0a);border:1px solid ${C.gold}44;border-radius:22px;padding:22px;position:relative;overflow:hidden;margin-bottom:20px}
.wallet-card::before{content:'';position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,.15),transparent 70%)}
.wallet-card::after{content:'';position:absolute;bottom:-40px;left:-20px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,.08),transparent 70%)}
.pts-big{font-size:48px;font-weight:800;color:${C.gold};line-height:1;font-family:'Playfair Display',serif}
.reward-item{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;cursor:pointer;transition:all .2s;margin-bottom:8px}
.reward-item:active{border-color:${C.gold};transform:scale(.98)}
.reward-item.locked{opacity:.5;cursor:not-allowed}

/* --- V12 PIN LOCK --- */
.pin-screen{position:fixed;inset:0;background:${C.bg};z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;max-width:430px;left:50%;transform:translateX(-50%)}
.pin-dot{width:16px;height:16px;border-radius:50%;border:2px solid ${C.gold};transition:all .2s;flex-shrink:0}
.pin-dot.filled{background:${C.gold};transform:scale(1.1)}
.pin-key{width:72px;height:72px;border-radius:50%;background:${C.surface};border:1px solid ${C.border};display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;font-size:22px;font-weight:700}
.pin-key:active{background:rgba(201,168,76,.15);border-color:${C.gold};transform:scale(.93)}
.pin-key.del{background:transparent;border-color:transparent;font-size:18px;color:${C.muted}}
.pin-shake{animation:pinShake .4s ease}
@keyframes pinShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}

/* --- V13: CONSULTATION FORMS --- */
.consult-step{background:${C.card};border:1px solid ${C.border};border-radius:18px;padding:18px;margin-bottom:12px}
.consult-option{padding:12px 16px;border-radius:12px;border:1px solid ${C.border};background:${C.surface};cursor:pointer;transition:all .18s;margin-bottom:8px;display:flex;align-items:center;gap:10}
.consult-option.sel{border-color:${C.gold};background:rgba(201,168,76,.08)}
.consult-option.sel::after{content:'✓';color:${C.gold};font-weight:700;margin-left:auto}
.hair-chip{padding:8px 14px;border-radius:20px;border:1px solid ${C.border};background:${C.surface};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;flex-shrink:0}
.hair-chip.sel{border-color:${C.gold};background:rgba(201,168,76,.1);color:${C.gold}}
.consult-progress{height:3px;background:${C.border};border-radius:2px;overflow:hidden;margin-bottom:24px}
.consult-progress-fill{height:100%;background:linear-gradient(90deg,${C.goldDim},${C.gold});border-radius:2px;transition:width .4s ease}
.consult-sent{background:linear-gradient(135deg,rgba(76,175,122,.1),rgba(76,175,122,.05));border:1px solid rgba(76,175,122,.3);border-radius:20px;padding:32px;text-align:center}

/* --- V13: BIRTHDAY AUTOMATION --- */
.bday-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:all .2s;display:flex;gap:12px;align-items:center}
.bday-card:active{border-color:${C.gold};transform:scale(.98)}
.bday-avatar{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;font-weight:700;color:white}
.bday-this-week{border-color:rgba(201,168,76,.4);background:rgba(201,168,76,.04)}
.automation-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid ${C.border}}

/* --- V13: BEFORE/AFTER REQUEST --- */
.ref-photo-slot{width:calc(50% - 6px);aspect-ratio:1;border-radius:16px;border:2px dashed ${C.border};display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;background:${C.surface};position:relative;overflow:hidden}
.ref-photo-slot:active{border-color:${C.gold}}
.ref-photo-slot.filled{border-style:solid;border-color:${C.gold}}
.style-inspo-card{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;cursor:pointer;transition:all .2s;text-align:center}
.style-inspo-card.sel{border-color:${C.gold};background:rgba(201,168,76,.06)}
.style-inspo-card:active{transform:scale(.97)}
.ba-submitted{background:linear-gradient(135deg,rgba(91,156,246,.1),rgba(167,139,250,.08));border:1px solid rgba(91,156,246,.3);border-radius:20px;padding:28px;text-align:center}

/* --- V13: CHAIR RENTAL MANAGEMENT --- */
.chair-card{background:${C.card};border:1px solid ${C.border};border-radius:18px;padding:16px;margin-bottom:12px;transition:all .2s;cursor:pointer}
.chair-card:active{border-color:${C.gold};transform:scale(.98)}
.chair-status-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.chair-status-badge.active{background:rgba(76,175,122,.15);color:${C.green}}
.chair-status-badge.vacant{background:rgba(245,158,11,.15);color:${C.orange}}
.chair-status-badge.overdue{background:rgba(224,82,82,.15);color:${C.red}}
.rent-timeline{display:flex;height:6px;border-radius:3px;overflow:hidden;margin-top:6px}
.rent-paid{background:${C.green}}
.rent-due{background:${C.orange}}
.rent-overdue{background:${C.red}}

/* --- V13: WAITING ROOM DISPLAY --- */
.tv-screen{background:#0a0a0c;border-radius:20px;overflow:hidden;border:3px solid #333;position:relative;font-family:'Playfair Display',serif}
.tv-queue-row{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.06);transition:all .3s}
.tv-queue-row.next{background:rgba(201,168,76,.12);border-left:4px solid ${C.gold}}
.tv-queue-row.serving{background:rgba(76,175,122,.1);border-left:4px solid ${C.green}}
.tv-number{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;flex-shrink:0}
.tv-ticker{overflow:hidden;white-space:nowrap;padding:8px 20px;background:rgba(201,168,76,.1);border-top:1px solid rgba(201,168,76,.2)}
.tv-ticker-inner{display:inline-block;animation:ticker 20s linear infinite}
@keyframes ticker{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}

/* --- V13: BREAK SCHEDULER --- */
.shift-block{border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;flex:1;min-height:34px}
.shift-block:active{transform:scale(.95)}
.break-row{display:flex;align-items:center;gap:10;padding:12px 0;border-bottom:1px solid ${C.border}}
.break-tag{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;flex-shrink:0}

/* --- V14: ACH / BANK PAYOUTS --- */
.bank-card{background:linear-gradient(135deg,#0f1a0f,#162616);border:1px solid rgba(76,175,122,.25);border-radius:20px;padding:20px;position:relative;overflow:hidden;margin-bottom:12px}
.bank-card::before{content:'';position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;background:rgba(76,175,122,.06)}
.payout-row{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid ${C.border}}
.payout-status{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.payout-status.completed{background:rgba(76,175,122,.15);color:${C.green}}
.payout-status.pending{background:rgba(245,158,11,.15);color:${C.orange}}
.payout-status.processing{background:rgba(91,156,246,.15);color:${C.blue}}
.payout-status.failed{background:rgba(224,82,82,.15);color:${C.red}}
.ach-step-num{width:28px;height:28px;border-radius:50%;background:${C.gold};color:#000;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}

/* --- V14: PRICE OVERRIDE & DISCOUNTS --- */
.override-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:all .2s}
.override-card:active{transform:scale(.98)}
.override-status{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.override-status.pending{background:rgba(245,158,11,.15);color:${C.orange}}
.override-status.approved{background:rgba(76,175,122,.15);color:${C.green}}
.override-status.denied{background:rgba(224,82,82,.15);color:${C.red}}
.approval-pin-dot{width:14px;height:14px;border-radius:50%;border:2px solid ${C.gold};background:transparent;transition:background .15s}
.approval-pin-dot.filled{background:${C.gold};border-color:${C.gold}}
.discount-preset{flex:1;padding:12px 4px;border-radius:12px;border:1px solid ${C.border};background:${C.surface};text-align:center;cursor:pointer;transition:all .18s}
.discount-preset.sel{border-color:${C.gold};background:rgba(201,168,76,.1)}

/* --- V14: REVENUE BY SERVICE --- */
.service-rev-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid ${C.border}}
.svc-rank-bubble{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0}
.rev-legend-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}

/* --- V14: OCCUPANCY & UTILIZATION --- */
.occ-grid-cell{border-radius:6px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700}
.occ-grid-cell:active{transform:scale(.9)}
.util-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;text-align:center}

/* --- V15: GOOGLE BUSINESS PROFILE --- */
.gbp-status{display:flex;align-items:center;gap:8px;padding:12px 16px;background:rgba(76,175,122,.08);border:1px solid rgba(76,175,122,.2);border-radius:12px;margin-bottom:16px}
.gbp-metric{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;text-align:center;flex:1}
.gbp-photo-slot{width:80px;height:80px;border-radius:12px;object-fit:cover;background:${C.card};border:1px solid ${C.border};display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;cursor:pointer;transition:all .18s}
.gbp-photo-slot:active{transform:scale(.95);border-color:${C.gold}}
.review-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.star-fill{color:#F59E0B;font-size:14px}

/* --- V15: COMPETITOR RATE --- */
.comp-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden}
.comp-badge-cheaper{position:absolute;top:12px;right:12px;background:rgba(76,175,122,.15);color:${C.green};border:1px solid rgba(76,175,122,.3);border-radius:8px;padding:3px 8px;font-size:10px;font-weight:700}
.comp-badge-pricier{position:absolute;top:12px;right:12px;background:rgba(224,82,82,.12);color:${C.red};border:1px solid rgba(224,82,82,.25);border-radius:8px;padding:3px 8px;font-size:10px;font-weight:700}
.comp-bar{height:6px;border-radius:3px;background:${C.border};overflow:hidden;margin-top:4px}
.comp-bar-fill{height:100%;border-radius:3px;transition:width .5s ease}
.price-comparison-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid ${C.border}}

/* --- V15: WIN-BACK CAMPAIGNS --- */
.wb-seg{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px;cursor:pointer;transition:all .2s}
.wb-seg.sel{border-color:${C.gold};background:rgba(201,168,76,.06)}
.wb-seg:active{transform:scale(.97)}
.wb-timeline{position:relative;padding-left:24px}
.wb-timeline::before{content:'';position:absolute;left:8px;top:0;bottom:0;width:1px;background:${C.border}}
.wb-step{position:relative;padding:10px 0 10px 12px;border-bottom:1px solid ${C.border}}
.wb-step::before{content:'';position:absolute;left:-20px;top:14px;width:10px;height:10px;border-radius:50%;background:${C.gold};border:2px solid ${C.bg}}
.wb-stat{background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:12px;text-align:center;flex:1}

/* --- V15: DARK/LIGHT MODE --- */
.theme-card{background:${C.card};border:2px solid ${C.border};border-radius:18px;padding:20px;cursor:pointer;transition:all .2s;text-align:center;flex:1}
.theme-card.sel{border-color:${C.gold};background:rgba(201,168,76,.06)}
.theme-card:active{transform:scale(.97)}
.theme-preview{width:100%;height:80px;border-radius:12px;margin-bottom:12px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px}
.accent-dot{width:28px;height:28px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:all .18s;flex-shrink:0}
.accent-dot.sel{border-color:white;transform:scale(1.15)}

/* --- V15: ONBOARDING TOUR --- */
.tour-slide{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;text-align:center;animation:screenIn .4s ease}
.tour-icon-bg{width:120px;height:120px;border-radius:36px;display:flex;align-items:center;justify-content:center;font-size:54px;margin:0 auto 24px;position:relative;overflow:hidden}
.tour-icon-bg::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.15),transparent)}
.tour-dot-nav{display:flex;gap:8px;justify-content:center;margin:24px 0}
.tour-dot{width:8px;height:8px;border-radius:50%;background:${C.border};transition:all .3s;cursor:pointer}
.tour-dot.act{background:${C.gold};width:24px;border-radius:4px}
.feature-tour-pill{display:flex;align-items:center;gap:10px;background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:12px 14px;margin-bottom:8px;text-align:left}

/* --- V15: OFFLINE MODE --- */
.offline-banner{background:rgba(224,82,82,.1);border:1px solid rgba(224,82,82,.25);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:16px}
.online-banner{background:rgba(76,175,122,.08);border:1px solid rgba(76,175,122,.2);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:16px}
.sync-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid ${C.border}}
.sync-pulse{width:10px;height:10px;border-radius:50%;background:${C.green};animation:syncPulse 1.5s ease infinite}
@keyframes syncPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
.offline-queue-item{background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px}

/* --- V15: PUSH DEEP LINKS --- */
.deep-link-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:all .18s}
.deep-link-card:active{border-color:${C.gold}}
.notif-preview{background:#1A1A2E;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid #2A2A4A}
.notif-preview-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.notif-app-icon{width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,${C.gold},${C.goldDim});display:flex;align-items:center;justify-content:center;font-size:12px}
.link-type-chip{padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ${C.border};background:${C.card};color:${C.muted};transition:all .18s}
.link-type-chip.sel{background:rgba(201,168,76,.1);border-color:${C.gold};color:${C.gold}}
`;


// ── CONSTANTS / MOCK DATA ──
const ALL_SLOTS=["9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM"];
const TAKEN_SLOTS=["9:30 AM","11:00 AM","1:00 PM","3:30 PM","5:00 PM"];
const WEEKLY=[42,68,55,90,120,85,145];
const DAYS=["M","T","W","T","F","S","S"];
const SVCS=[
  {name:"Haircut",price:30,dur:"30 min",icon:"✂️",desc:"Classic cut, styled to perfection"},
  {name:"Fade",price:40,dur:"45 min",icon:"💈",desc:"Seamless skin to mid fade"},
  {name:"Beard Trim",price:20,dur:"20 min",icon:"🧔",desc:"Shape, line, and condition"},
  {name:"Shape-Up",price:25,dur:"20 min",icon:"📐",desc:"Crisp edges and clean lines"},
  {name:"Fade + Beard",price:55,dur:"60 min",icon:"💈",desc:"Full grooming experience"},
  {name:"Color",price:70,dur:"90 min",icon:"🎨",desc:"Professional color treatment"},
  {name:"Braids",price:95,dur:"120 min",icon:"🎀",desc:"Box braids, cornrows & more"},
];
const INIT_APPTS=[
  {id:1,name:"Marcus J.",service:"Fade + Beard",time:"10:00 AM",price:45,phone:"(504) 555-0192",recurring:null,status:"confirmed"},
  {id:2,name:"DeShawn W.",service:"Shape-Up",time:"11:30 AM",price:25,phone:"(504) 555-0247",recurring:"Weekly",status:"confirmed"},
  {id:3,name:"Carlos M.",service:"Haircut + Color",time:"2:00 PM",price:75,phone:"(504) 555-0318",recurring:null,status:"confirmed"},
  {id:4,name:"Tre L.",service:"Braids",time:"3:00 PM",price:85,phone:"(504) 555-0423",recurring:"Biweekly",status:"confirmed"},
];
const TXS=[
  {id:1,name:"Marcus J.",service:"Fade + Beard",amount:45,tip:9,date:"Today",icon:"✂️",type:"in"},
  {id:2,name:"DeShawn W.",service:"Shape-Up",amount:25,tip:5,date:"Today",icon:"💈",type:"in"},
  {id:3,name:"Joey T.",service:"Haircut",amount:30,tip:7,date:"Yesterday",icon:"✂️",type:"in"},
  {id:4,name:"Brandon K.",service:"Color",amount:65,tip:15,date:"Yesterday",icon:"🎨",type:"in"},
  {id:5,name:"Stripe Fee",service:"Processing",amount:-2.10,tip:0,date:"Yesterday",icon:"💳",type:"out"},
];
const CLIENTS=[
  {id:1,name:"Marcus J.",phone:"(504) 555-0192",avatar:"M",visits:24,spent:980,lastVisit:"Feb 15",nextVisit:"Mar 1",preferredSvc:"Fade",points:480,tier:"Gold",noShows:0,recurring:"Biweekly",gradient:[C.gold,C.goldDim],
    history:[
      {date:"Feb 15",service:"Fade + Beard",price:54,tip:9,note:"Low fade, line up beard sharp"},
      {date:"Feb 1",service:"Fade",price:40,tip:8,note:"Same as last time"},
      {date:"Jan 18",service:"Fade + Beard",price:54,tip:10,note:""},
      {date:"Jan 4",service:"Shape-Up",price:25,tip:5,note:"Wanted it tighter on sides"},
    ]},
  {id:2,name:"DeShawn W.",phone:"(504) 555-0247",avatar:"D",visits:18,spent:720,lastVisit:"Feb 12",nextVisit:"Feb 19",preferredSvc:"Shape-Up",points:360,tier:"Silver",noShows:1,recurring:"Weekly",gradient:[C.blue,"#2D5AB0"],
    history:[
      {date:"Feb 12",service:"Shape-Up",price:30,tip:5,note:"Keep it clean, square top"},
      {date:"Feb 5",service:"Shape-Up",price:30,tip:5,note:""},
      {date:"Jan 29",service:"Shape-Up",price:30,tip:6,note:""},
    ]},
  {id:3,name:"Carlos M.",phone:"(504) 555-0318",avatar:"C",visits:9,spent:540,lastVisit:"Feb 10",nextVisit:"Mar 5",preferredSvc:"Color",points:180,tier:"Bronze",noShows:0,recurring:null,gradient:[C.purple,"#5B3AB0"],
    history:[
      {date:"Feb 10",service:"Color",price:70,tip:15,note:"Fade underneath, color on top — dark brown"},
      {date:"Jan 20",service:"Haircut + Color",price:90,tip:18,note:"Trim sides shorter"},
    ]},
  {id:4,name:"Tre L.",phone:"(504) 555-0423",avatar:"T",visits:12,spent:860,lastVisit:"Feb 8",nextVisit:"Feb 22",preferredSvc:"Braids",points:240,tier:"Silver",noShows:0,recurring:"Biweekly",gradient:[C.green,"#1E6B46"],
    history:[
      {date:"Feb 8",service:"Braids",price:95,tip:20,note:"Box braids, medium size, keep length"},
      {date:"Jan 25",service:"Braids",price:95,tip:20,note:""},
      {date:"Jan 11",service:"Braids",price:95,tip:20,note:""},
    ]},
  {id:5,name:"Joey T.",phone:"(504) 555-0531",avatar:"J",visits:5,spent:165,lastVisit:"Feb 5",nextVisit:null,preferredSvc:"Haircut",points:50,tier:"Bronze",noShows:1,recurring:null,gradient:[C.orange,"#B36B00"],
    history:[{date:"Feb 5",service:"Haircut",price:30,tip:7,note:"Textured crop, leave some length on top"}]},
  {id:6,name:"Brandon K.",phone:"(504) 555-0682",avatar:"B",visits:7,spent:420,lastVisit:"Feb 1",nextVisit:"Mar 1",preferredSvc:"Haircut",points:140,tier:"Bronze",noShows:0,recurring:null,gradient:[C.pink,"#A0185A"],
    history:[
      {date:"Feb 1",service:"Color",price:65,tip:15,note:"Highlights on top, fade sides"},
      {date:"Jan 10",service:"Haircut",price:30,tip:7,note:""},
    ]},
];
const WAITLIST_INIT=[
  {id:1,name:"Khalil R.",phone:"(504) 555-0791",service:"Fade",addedAt:"8:12 AM",position:1,notified:false,eta:"~45 min",avatar:"K",color:C.blue,priority:"normal",note:""},
  {id:2,name:"Leon T.",phone:"(504) 555-0834",service:"Haircut",addedAt:"9:30 AM",position:2,notified:false,eta:"~1.5 hrs",avatar:"L",color:C.green,priority:"normal",note:""},
  {id:3,name:"Samira B.",phone:"(504) 555-0562",service:"Braids",addedAt:"10:15 AM",position:3,notified:false,eta:"~2 hrs",avatar:"S",color:C.pink,priority:"vip",note:"Regular — prefers box braids"},
  {id:4,name:"Darnell F.",phone:"(504) 555-0119",service:"Shape-Up",addedAt:"11:00 AM",position:4,notified:false,eta:"~3 hrs",avatar:"D",color:C.purple,priority:"normal",note:""},
];
const NOSHOWS_INIT=[
  {id:1,name:"Joey T.",service:"Haircut",time:"2:00 PM",date:"Feb 8",feeAmt:15,feeStatus:"pending",avatar:"J",color:C.orange,noShowCount:2,blocked:false},
  {id:2,name:"Brandon K.",service:"Haircut",time:"4:30 PM",date:"Jan 30",feeAmt:15,feeStatus:"charged",avatar:"B",color:C.pink,noShowCount:1,blocked:false},
  {id:3,name:"Khalil R.",service:"Fade",time:"11:30 AM",date:"Jan 22",feeAmt:20,feeStatus:"waived",avatar:"K",color:C.blue,noShowCount:1,blocked:false},
  {id:4,name:"Ray S.",service:"Beard Trim",time:"3:30 PM",date:"Jan 10",feeAmt:10,feeStatus:"charged",avatar:"R",color:C.red,noShowCount:3,blocked:true},
];
// Today's appointments that are "at risk" (approaching time, no check-in)
const AT_RISK_INIT=[
  {id:3,name:"Carlos M.",service:"Haircut + Color",time:"2:00 PM",minutesUntil:18,phone:"(504) 555-0318",avatar:"C",color:C.purple},
  {id:4,name:"Tre L.",service:"Braids",time:"3:00 PM",minutesUntil:78,phone:"(504) 555-0423",avatar:"T",color:C.green},
];

// ── NOTIFICATIONS DATA ──
const NOTIFS_INIT=[
  {id:1,type:"appt",icon:"📅",title:"New booking — Khalil R.",body:"Fade · Tomorrow 10:00 AM",time:"2 min ago",read:false},
  {id:2,type:"pay",icon:"💰",title:"Payment received — $54",body:"Marcus J. · Fade + Beard",time:"1 hr ago",read:false},
  {id:3,type:"alert",icon:"🚨",title:"No-show — Joey T.",body:"2:00 PM slot is now open",time:"2 hrs ago",read:false},
  {id:4,type:"mktg",icon:"📣",title:"SMS blast sent",body:"47 clients notified — 3 bookings so far",time:"3 hrs ago",read:true},
  {id:5,type:"appt",icon:"🔄",title:"Recurring confirmed — DeShawn W.",body:"Weekly Shape-Up auto-booked",time:"Yesterday",read:true},
  {id:6,type:"pay",icon:"💳",title:"Stripe payout processed",body:"$1,247.80 → Chase ••4821",time:"Yesterday",read:true},
  {id:7,type:"alert",icon:"⭐",title:"New review from Marcus J.",body:"5 stars — 'Best fade in NOLA'",time:"2 days ago",read:true},
  {id:8,type:"mktg",icon:"🎁",title:"Gift card redeemed",body:"CHOP-4432 · $12 applied by Carlos M.",time:"3 days ago",read:true},
];
// ── INVENTORY DATA ──
const INVENTORY_INIT=[
  {id:1,name:"Pomade — Murray's",category:"Products",sku:"PRD-001",price:12,cost:5,qty:8,maxQty:20,reorderAt:5,unit:"jar",icon:"🫙",sold30d:14},
  {id:2,name:"Clippers Oil",category:"Supplies",sku:"SUP-001",price:0,cost:3,qty:2,maxQty:10,reorderAt:3,unit:"bottle",icon:"🔧",sold30d:0},
  {id:3,name:"Fade Cream",category:"Products",sku:"PRD-002",price:18,cost:7,qty:0,maxQty:15,reorderAt:4,unit:"tube",icon:"💊",sold30d:9},
  {id:4,name:"Disposable Capes",category:"Supplies",sku:"SUP-002",price:0,cost:0.5,qty:45,maxQty:100,reorderAt:20,unit:"pack",icon:"🧤",sold30d:0},
  {id:5,name:"Beard Oil",category:"Products",sku:"PRD-003",price:22,cost:9,qty:11,maxQty:20,reorderAt:5,unit:"bottle",icon:"🧴",sold30d:7},
  {id:6,name:"Edge Control",category:"Products",sku:"PRD-004",price:15,cost:6,qty:4,maxQty:15,reorderAt:4,unit:"jar",icon:"✨",sold30d:11},
  {id:7,name:"Straight Razor Blades",category:"Supplies",sku:"SUP-003",price:0,cost:8,qty:30,maxQty:50,reorderAt:10,unit:"pack",icon:"🪒",sold30d:0},
];
// ── SOCIAL POSTS DATA ──
const SOCIAL_POSTS_INIT=[
  {id:1,platform:["Instagram","Facebook"],content:"🔥 Fresh fade Friday! Slots still open this afternoon — DM or book at the link in bio ✂️ #Barbershop #NOLA #ChopItUp",media:"cut",scheduled:"Today 3:00 PM",status:"scheduled",likes:0,reach:0},
  {id:2,platform:["Instagram"],content:"Client transformation 💈 Before → After. Book your glow-up at chopitup.app/marcus",media:"before_after",scheduled:"Yesterday 6:00 PM",status:"published",likes:47,reach:312},
  {id:3,platform:["Facebook"],content:"FLASH SALE this Monday: $5 off any service. First come, first served! Reply to book.",media:"promo",scheduled:"Feb 17 10:00 AM",status:"published",likes:23,reach:189},
];
// ── MULTI-BARBER DATA ──
const SHOP_BARBERS=[
  {id:1,name:"Marcus J.",role:"Owner",avatar:"M",color:C.gold,chair:1,status:"busy",currentClient:"DeShawn W.",nextAppt:"11:30 AM",revenue:2840,appts:63,rating:4.9,phone:"(504) 555-0100",schedule:["Fade","","Shape-Up","","Braids","",""]},
  {id:2,name:"Darius B.",role:"Barber",avatar:"D",color:C.blue,chair:2,status:"active",currentClient:null,nextAppt:"12:00 PM",revenue:1920,appts:44,rating:4.8,phone:"(504) 555-0200",schedule:["","Haircut","","Color","","Haircut",""]},
  {id:3,name:"Jerome W.",role:"Barber",avatar:"J",color:C.green,chair:3,status:"offline",currentClient:null,nextAppt:null,revenue:1540,appts:38,rating:4.7,phone:"(504) 555-0300",schedule:["","","","","","","Fade"]},
];
const CHAIR_TIMES=["9AM","11AM","1PM","3PM","5PM"];

const LOYALTY_TIERS=[
  {name:"Bronze",min:0,max:199,color:"#CD7F32",perks:["5% off every 5th visit","Birthday discount"]},
  {name:"Silver",min:200,max:499,color:"#9E9E9E",perks:["10% off every 5th visit","Priority booking","Free beard trim on birthday"]},
  {name:"Gold",min:500,max:999,color:C.gold,perks:["15% off every 5th visit","Skip the waitlist","Free service on birthday","Early access to promos"]},
  {name:"Platinum",min:1000,max:99999,color:"#E8F0FF",perks:["20% off every visit","Always #1 on waitlist","Monthly free service","Dedicated slot reserved"]},
];
const GIFT_CARDS_INIT=[
  {id:"GC-8821",amount:50,balance:50,purchaser:"Gift from Mom",redeemed:false,code:"CHOP-8821",created:"Feb 10"},
  {id:"GC-4432",amount:30,balance:12,purchaser:"Carlos M.",redeemed:false,code:"CHOP-4432",created:"Jan 28"},
];
const ADMIN_BARBERS=[
  {id:1,name:"Marcus J.",role:"Owner",revenue:2840,appts:63,rating:4.9,active:true,avatar:"M",color:C.gold},
  {id:2,name:"Darius B.",role:"Barber",revenue:1920,appts:44,rating:4.8,active:true,avatar:"D",color:C.blue},
  {id:3,name:"Jerome W.",role:"Barber",revenue:1540,appts:38,rating:4.7,active:true,avatar:"J",color:C.green},
];
const MONTHLY_DATA=[820,940,1100,980,1240,1380,1520,1420,1680,1820,2100,2380];
const MONTHS=["J","F","M","A","M","J","J","A","S","O","N","D"];

// ── REVIEWS DATA ──
const REVIEWS_INIT=[
  {id:1,name:"Marcus J.",avatar:"M",color:C.gold,rating:5,date:"Feb 15",service:"Fade + Beard",body:"Best fade in NOLA, no cap. Marcus always delivers. Been coming here for 2 years and never leaving.",platform:"Google",reply:"Appreciate you bro! See you on March 1st 💈",repliedAt:"Feb 15"},
  {id:2,name:"DeShawn W.",avatar:"D",color:C.blue,rating:5,date:"Feb 12",service:"Shape-Up",body:"Crispy shape-up every single time. Whole shop got good vibes too. Highly recommend.",platform:"Google",reply:null,repliedAt:null},
  {id:3,name:"Tre L.",avatar:"T",color:C.green,rating:5,date:"Feb 8",service:"Braids",body:"My braids always come out perfect. No one else touches my hair now. 5 stars all day.",platform:"Yelp",reply:"Thank you Tre! Those box braids 🔥 See you in 2 weeks.",repliedAt:"Feb 9"},
  {id:4,name:"Carlos M.",avatar:"C",color:C.purple,rating:4,date:"Feb 5",service:"Color",body:"Great color job, blended perfectly. Was a little wait but worth it. Will definitely be back.",platform:"Google",reply:null,repliedAt:null},
  {id:5,name:"Joey T.",avatar:"J",color:C.orange,rating:4,date:"Jan 28",service:"Haircut",body:"Clean cut, friendly service. Shop was a bit busy but they got to me in a reasonable time.",platform:"Yelp",reply:null,repliedAt:null},
  {id:6,name:"Brandon K.",avatar:"B",color:C.pink,rating:5,date:"Jan 20",service:"Color + Fade",body:"Had never done a color before — Marcus made me feel comfortable and the result was amazing. I'm obsessed.",platform:"Google",reply:"Love to see it! Come back any time. 🙌",repliedAt:"Jan 21"},
];

// ── CALENDAR DATA ──
const CAL_HOURS=["8 AM","9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM","6 PM","7 PM"];
const CAL_APPTS=[
  {id:1,barber:"Marcus",day:0,startH:9,startM:0,dur:60,client:"Marcus J.",service:"Fade + Beard",color:C.gold},
  {id:2,barber:"Marcus",day:0,startH:10,startM:30,dur:30,client:"DeShawn W.",service:"Shape-Up",color:C.blue},
  {id:3,barber:"Marcus",day:0,startH:14,startM:0,dur:90,client:"Tre L.",service:"Braids",color:C.green},
  {id:4,barber:"Darius",day:0,startH:9,startM:30,dur:45,client:"Carlos M.",service:"Haircut",color:C.purple},
  {id:5,barber:"Darius",day:0,startH:13,startM:0,dur:60,client:"Joey T.",service:"Color",color:C.orange},
  {id:6,barber:"Marcus",day:1,startH:9,startM:0,dur:45,client:"Brandon K.",service:"Haircut",color:C.pink},
  {id:7,barber:"Marcus",day:1,startH:11,startM:0,dur:60,client:"Khalil R.",service:"Fade",color:C.blue},
  {id:8,barber:"Darius",day:1,startH:10,startM:0,dur:60,client:"Leon T.",service:"Haircut",color:C.green},
  {id:9,barber:"Jerome",day:2,startH:10,startM:0,dur:45,client:"Marcus J.",service:"Fade",color:C.gold},
  {id:10,barber:"Jerome",day:2,startH:14,startM:30,dur:60,client:"Samira B.",service:"Braids",color:C.pink},
  {id:11,barber:"Marcus",day:3,startH:9,startM:30,dur:60,client:"Darnell F.",service:"Shape-Up",color:C.purple},
  {id:12,barber:"Marcus",day:4,startH:10,startM:0,dur:45,client:"Marcus J.",service:"Beard",color:C.gold},
  {id:13,barber:"Darius",day:4,startH:11,startM:0,dur:90,client:"Brandon K.",service:"Color",color:C.pink},
];

// ── STRIPE DATA ──
const STRIPE_PAYOUTS=[
  {id:1,amount:1247.80,date:"Feb 17",status:"paid",account:"Chase ••4821",days:"2-day"},
  {id:2,amount:980.50,date:"Feb 10",status:"paid",account:"Chase ••4821",days:"2-day"},
  {id:3,amount:1540.00,date:"Feb 3",status:"paid",account:"Chase ••4821",days:"2-day"},
  {id:4,amount:760.25,date:"Jan 27",status:"paid",account:"Chase ••4821",days:"2-day"},
];
const STRIPE_READERS=[
  {id:1,name:"Stripe Reader S700",serial:"STR-S700-001",status:"connected",battery:82,location:"Chair 1",lastUsed:"10 min ago"},
  {id:2,name:"Stripe Reader M2",serial:"STR-M2-002",status:"offline",battery:0,location:"Chair 2",lastUsed:"2 days ago"},
];

// ── SMS THREAD DATA ──
const SMS_THREADS={
  "Marcus J.":[
    {from:"barber",text:"Hey Marcus! Your fade + beard is confirmed for Feb 15 at 10:00 AM ✅",time:"Feb 14 9:00 AM"},
    {from:"client",text:"Perfect, I'll be there 🙌",time:"Feb 14 9:12 AM"},
    {from:"barber",text:"⏰ Reminder: You have an appointment tomorrow (Feb 15) at 10:00 AM. Reply CANCEL to cancel or RESCHEDULE to change time.",time:"Feb 14 6:00 PM"},
    {from:"client",text:"See you then!",time:"Feb 14 6:18 PM"},
    {from:"barber",text:"Appointment complete! How'd we do? Leave us a Google review: g.co/chopitup 🌟",time:"Feb 15 11:30 AM"},
    {from:"client",text:"Just left 5 stars! Best in NOLA fr",time:"Feb 15 11:48 AM"},
  ],
  "DeShawn W.":[
    {from:"barber",text:"DeShawn — your Shape-Up is booked for Feb 19 at 9:00 AM ✅",time:"Feb 18 8:00 AM"},
    {from:"client",text:"Bet, see you then",time:"Feb 18 8:22 AM"},
    {from:"barber",text:"⏰ Reminder: Tomorrow Feb 19 at 9:00 AM. Reply RESCHEDULE to change.",time:"Feb 18 6:00 PM"},
  ],
};

// ── SERVICE MENU DATA ──
const SVCS_INIT=[
  {id:1,name:"Fade",category:"Cuts",price:35,duration:45,popular:true,featured:true,addOns:["Beard Lineup","Hot Towel"],desc:"Classic taper fade, clean and sharp",icon:"✂️"},
  {id:2,name:"Shape-Up",category:"Cuts",price:25,duration:30,popular:true,featured:false,addOns:["Razor Line","Design"],desc:"Edge-up and line work",icon:"📐"},
  {id:3,name:"Haircut",category:"Cuts",price:30,duration:40,popular:false,featured:false,addOns:["Wash","Style"],desc:"Full haircut, scissors or clippers",icon:"💈"},
  {id:4,name:"Fade + Beard",category:"Combos",price:55,duration:60,popular:true,featured:true,addOns:["Hot Towel","Scalp Massage"],desc:"Fade cut with full beard trim & lineup",icon:"🧔"},
  {id:5,name:"Color",category:"Color",price:75,duration:90,popular:false,featured:false,addOns:["Toner","Treatment"],desc:"Single-process color, highlights, or tint",icon:"🎨"},
  {id:6,name:"Braids",category:"Braids",price:95,duration:120,popular:false,featured:true,addOns:["Wash","Moisture Treatment"],desc:"Box braids, cornrows, and more",icon:"〰️"},
  {id:7,name:"Beard Trim",category:"Beard",price:20,duration:20,popular:true,featured:false,addOns:["Hot Towel","Beard Oil"],desc:"Shape and trim beard or goatee",icon:"🪒"},
  {id:8,name:"Kid's Cut",category:"Cuts",price:22,duration:30,popular:false,featured:false,addOns:["Style"],desc:"Children's haircut (12 & under)",icon:"👦"},
];

// ── REFERRAL DATA ──
const REFERRALS_INIT=[
  {id:1,name:"Marcus J.",avatar:"M",color:C.gold,referredName:"Darius B.",stage:"rewarded",date:"Jan 15",reward:"$10 off",earned:true},
  {id:2,name:"DeShawn W.",avatar:"D",color:C.blue,referredName:"Leon T.",stage:"visited",date:"Feb 1",reward:"$10 off",earned:false},
  {id:3,name:"Carlos M.",avatar:"C",color:C.purple,referredName:"Samira B.",stage:"visited",date:"Feb 8",reward:"$10 off",earned:false},
  {id:4,name:"Tre L.",avatar:"T",color:C.green,referredName:"Khalil R.",stage:"signed-up",date:"Feb 14",reward:"$10 off",earned:false},
  {id:5,name:"Marcus J.",avatar:"M",color:C.gold,referredName:"Darnell F.",stage:"rewarded",date:"Dec 20",reward:"$10 off",earned:true},
];

// ── FORECASTING DATA ──
const FORECAST_MONTHS=["Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun"];
const ACTUAL_REVENUE=[1680,1820,2100,2380,1920,2290,0,0,0,0];
const PROJECTED_REV=[0,0,0,0,0,2290,2650,2880,3100,3340];
const GOALS_INIT=[
  {id:1,label:"Monthly Revenue",target:3000,current:2290,unit:"$",period:"Feb 2026",status:"on-track",icon:"💰"},
  {id:2,label:"New Clients",target:20,current:14,unit:"",period:"Feb 2026",status:"on-track",icon:"👤"},
  {id:3,label:"5-Star Reviews",target:10,current:6,unit:"",period:"Feb 2026",status:"behind",icon:"⭐"},
  {id:4,label:"Avg Ticket Size",target:55,current:48,unit:"$",period:"Feb 2026",status:"behind",icon:"🎫"},
  {id:5,label:"Q1 Revenue",target:8000,current:6210,unit:"$",period:"Q1 2026",status:"on-track",icon:"📊"},
];

// ── CASH-OUT DATA ──
const PAYMENT_METHODS_EOD=[
  {id:"card",label:"Card (Stripe)",icon:"💳",expected:1840.50,color:C.blue},
  {id:"cash",label:"Cash",icon:"💵",expected:320.00,color:C.green},
  {id:"applepay",label:"Apple Pay / Tap",icon:"📱",expected:127.30,color:C.purple},
  {id:"giftcard",label:"Gift Cards",icon:"🎁",expected:50.00,color:C.pink},
];
const DENOMINATIONS=[
  {val:100,label:"$100",qty:0},{val:50,label:"$50",qty:2},{val:20,label:"$20",qty:8},
  {val:10,label:"$10",qty:3},{val:5,label:"$5",qty:6},{val:1,label:"$1",qty:12},
];

// ── PORTFOLIO DATA ──
const PORTFOLIO_PHOTOS=[
  {id:1,barber:"Marcus",type:"fade",emoji:"✂️",tags:["Fade","Clean"],likes:47,date:"Feb 15",caption:"Low fade with skin taper 🔥"},
  {id:2,barber:"Marcus",type:"beard",emoji:"🧔",tags:["Beard","Fade"],likes:31,date:"Feb 12",caption:"Fade + beard combo. Client came in looking rough, left looking sharp 💈"},
  {id:3,barber:"Marcus",type:"braids",emoji:"〰️",tags:["Braids"],likes:62,date:"Feb 8",caption:"Box braids for the weekend 🔥"},
  {id:4,barber:"Darius",type:"color",emoji:"🎨",tags:["Color","Fade"],likes:55,date:"Feb 10",caption:"Color job with a taper. Dark brown blend 🎨"},
  {id:5,barber:"Marcus",type:"shape-up",emoji:"📐",tags:["Shape-Up","Edge"],likes:28,date:"Feb 6",caption:"Crispy shape-up ✅"},
  {id:6,barber:"Jerome",type:"braids",emoji:"〰️",tags:["Braids","Style"],likes:44,date:"Feb 3",caption:"Cornrows with a fade on the sides"},
  {id:7,barber:"Darius",type:"fade",emoji:"✂️",tags:["Fade"],likes:38,date:"Jan 30",caption:"Mid fade. Clean every time."},
  {id:8,barber:"Marcus",type:"color",emoji:"🎨",tags:["Color"],likes:71,date:"Jan 28",caption:"First color for this client — absolutely crushed it 💪"},
  {id:9,barber:"Jerome",type:"fade",emoji:"✂️",tags:["Fade","Classic"],likes:22,date:"Jan 25",caption:"Classic taper. Never goes out of style."},
  {id:10,barber:"Marcus",type:"beard",emoji:"🪒",tags:["Beard","Hot Towel"],likes:34,date:"Jan 22",caption:"Beard sculpt + hot towel finish 🔥"},
  {id:11,barber:"Darius",type:"shape-up",emoji:"📐",tags:["Shape-Up"],likes:19,date:"Jan 18",caption:"Razor sharp edge-up"},
  {id:12,barber:"Jerome",type:"color",emoji:"🎨",tags:["Color","Braids"],likes:58,date:"Jan 15",caption:"Color on top, clean braids. Absolute banger."},
];
function getCalendarDates(){
  const dates=[];
  const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now=new Date(2026,1,19);
  for(let i=0;i<14;i++){
    const d=new Date(now);
    d.setDate(now.getDate()+i);
    dates.push({day:days[d.getDay()],date:d.getDate(),month:months[d.getMonth()],full:`${months[d.getMonth()]} ${d.getDate()}, 2026`,available:d.getDay()!==0});
  }
  return dates;
}

// ── PAYROLL & COMMISSION DATA ──
const PAYROLL_BARBERS=[
  {id:1,name:"Marcus J.",avatar:"M",color:C.gold,role:"Owner",commissionRate:100,services:63,revenue:2840,tips:248,expenses:320,netPay:2768,status:"paid",payPeriod:"Feb 1–15"},
  {id:2,name:"Darius B.",avatar:"D",color:C.blue,role:"Barber",commissionRate:60,services:44,revenue:1920,tips:176,expenses:0,netPay:1328,status:"pending",payPeriod:"Feb 1–15"},
  {id:3,name:"Jerome W.",avatar:"J",color:C.green,role:"Barber",commissionRate:55,services:38,revenue:1540,tips:142,expenses:0,netPay:989,status:"pending",payPeriod:"Feb 1–15"},
];
const PAY_HISTORY=[
  {period:"Jan 16–31",total:3940,paid:true,date:"Feb 1"},
  {period:"Jan 1–15",total:3720,paid:true,date:"Jan 16"},
  {period:"Dec 16–31",total:4210,paid:true,date:"Jan 1"},
];

// ── TIP DATA ──
const TIPS_TODAY=[
  {barber:"Marcus",avatar:"M",color:C.gold,services:5,cash:28,card:42,total:70},
  {barber:"Darius",avatar:"D",color:C.blue,services:4,cash:15,card:31,total:46},
  {barber:"Jerome",avatar:"J",color:C.green,services:3,cash:10,card:20,total:30},
];
const TIP_HISTORY_WEEK=[
  {day:"Mon",marcus:55,darius:38,jerome:22},
  {day:"Tue",marcus:48,darius:30,jerome:18},
  {day:"Wed",marcus:62,darius:42,jerome:30},
  {day:"Thu",marcus:70,darius:46,jerome:30},
];

// ── TAX & EXPENSE DATA ──
const EXPENSES_INIT=[
  {id:1,desc:"Clippers — Wahl Senior",category:"Equipment",amount:89.99,date:"Feb 14",icon:"🔧",deductible:true,receipt:true},
  {id:2,desc:"Pomade & Beard Oil (wholesale)",category:"Supplies",amount:156.40,date:"Feb 10",icon:"🛍",deductible:true,receipt:true},
  {id:3,desc:"Shop Rent — February",category:"Rent",amount:1200,date:"Feb 1",icon:"🏢",deductible:true,receipt:false},
  {id:4,desc:"Instagram Ads",category:"Marketing",amount:75,date:"Jan 30",icon:"📱",deductible:true,receipt:true},
  {id:5,desc:"Barbicide & Sanitizer",category:"Supplies",amount:34.20,date:"Jan 28",icon:"🧴",deductible:true,receipt:true},
  {id:6,desc:"Business Insurance",category:"Insurance",amount:220,date:"Jan 15",icon:"🛡",deductible:true,receipt:true},
  {id:7,desc:"New Barber Chair",category:"Equipment",amount:640,date:"Jan 5",icon:"💺",deductible:true,receipt:true},
  {id:8,desc:"Lunch — client meeting",category:"Meals",amount:48.50,date:"Dec 28",icon:"🍽",deductible:false,receipt:false},
];
const TAX_CATEGORIES=["All","Equipment","Supplies","Rent","Marketing","Insurance","Meals","Other"];
const QUARTERLY_EST=[
  {q:"Q1 2026",income:6890,expenses:2415,profit:4475,tax:1120,due:"Apr 15",status:"upcoming"},
  {q:"Q4 2025",income:7200,expenses:2680,profit:4520,tax:1130,due:"Jan 15",status:"paid"},
  {q:"Q3 2025",income:6100,expenses:2200,profit:3900,tax:975,due:"Oct 15",status:"paid"},
];

// ── SUPPLY REORDER DATA ──
const SUPPLY_ITEMS=[
  {id:1,name:"Pomade — Murray's",category:"Product",qty:8,reorderAt:5,maxQty:20,unit:"jars",vendor:"Beauty Supply Plus",vendorPhone:"(504) 555-0199",lastOrdered:"Jan 20",cost:5,status:"ok",icon:"🫙"},
  {id:2,name:"Clippers Oil",category:"Supply",qty:2,reorderAt:3,maxQty:10,unit:"bottles",vendor:"Wahl Pro",vendorPhone:"(800) 756-9245",lastOrdered:"Feb 1",cost:3,status:"urgent",icon:"🔧"},
  {id:3,name:"Fade Cream",category:"Product",qty:0,reorderAt:4,maxQty:15,unit:"tubes",vendor:"Beauty Supply Plus",vendorPhone:"(504) 555-0199",lastOrdered:"Jan 10",cost:7,status:"urgent",icon:"💊"},
  {id:4,name:"Disposable Capes",category:"Supply",qty:45,reorderAt:20,maxQty:100,unit:"pack",vendor:"Barber World",vendorPhone:"(504) 555-0288",lastOrdered:"Dec 15",cost:0.5,status:"ok",icon:"🧤"},
  {id:5,name:"Beard Oil",category:"Product",qty:11,reorderAt:5,maxQty:20,unit:"bottles",vendor:"Beauty Supply Plus",vendorPhone:"(504) 555-0199",lastOrdered:"Feb 5",cost:9,status:"ok",icon:"🧴"},
  {id:6,name:"Edge Control",category:"Product",qty:4,reorderAt:4,maxQty:15,unit:"jars",vendor:"Barber World",vendorPhone:"(504) 555-0288",lastOrdered:"Jan 30",cost:6,status:"soon",icon:"✨"},
  {id:7,name:"Straight Razor Blades",category:"Supply",qty:8,reorderAt:10,maxQty:50,unit:"pack",vendor:"Wahl Pro",vendorPhone:"(800) 756-9245",lastOrdered:"Jan 25",cost:8,status:"soon",icon:"🪒"},
];
const PO_HISTORY=[
  {id:"PO-0042",date:"Feb 10",vendor:"Beauty Supply Plus",items:["Pomade x10","Beard Oil x5"],total:95,status:"delivered"},
  {id:"PO-0041",date:"Jan 28",vendor:"Wahl Pro",items:["Clippers Oil x6","Blades x2"],total:34,status:"delivered"},
  {id:"PO-0040",date:"Jan 15",vendor:"Barber World",items:["Capes x2 packs","Edge Control x5"],total:32.50,status:"delivered"},
];

// ── CHECK-IN DATA ──
const TODAYS_APPTS_CHECKIN=[
  {id:1,name:"Marcus J.",avatar:"M",color:C.gold,service:"Fade + Beard",time:"10:00 AM",barber:"Marcus",status:"checked-in",phone:"(504) 555-0192"},
  {id:2,name:"DeShawn W.",avatar:"D",color:C.blue,service:"Shape-Up",time:"11:30 AM",barber:"Marcus",status:"upcoming",phone:"(504) 555-0247"},
  {id:3,name:"Tre L.",avatar:"T",color:C.green,service:"Braids",time:"2:00 PM",barber:"Marcus",status:"upcoming",phone:"(504) 555-0423"},
  {id:4,name:"Carlos M.",avatar:"C",color:C.purple,service:"Color",time:"3:30 PM",barber:"Darius",status:"upcoming",phone:"(504) 555-0318"},
  {id:5,name:"Brandon K.",avatar:"B",color:C.pink,service:"Haircut",time:"5:00 PM",barber:"Jerome",status:"upcoming",phone:"(504) 555-0682"},
];

// ── RECURRING APPTS DATA ──
const RECURRING_APPTS=[
  {id:1,client:"Marcus J.",avatar:"M",color:C.gold,service:"Fade + Beard",frequency:"Biweekly",barber:"Marcus",nextDate:"Mar 1",lastDate:"Feb 15",price:54,active:true,streak:12,totalVisits:24,nextTime:"10:00 AM"},
  {id:2,client:"DeShawn W.",avatar:"D",color:C.blue,service:"Shape-Up",frequency:"Weekly",barber:"Marcus",nextDate:"Feb 26",lastDate:"Feb 19",price:30,active:true,streak:18,totalVisits:18,nextTime:"9:00 AM"},
  {id:3,client:"Tre L.",avatar:"T",color:C.green,service:"Braids",frequency:"Biweekly",barber:"Marcus",nextDate:"Feb 22",lastDate:"Feb 8",price:95,active:true,streak:6,totalVisits:12,nextTime:"2:00 PM"},
  {id:4,client:"Brandon K.",avatar:"B",color:C.pink,service:"Color + Fade",frequency:"Monthly",barber:"Darius",nextDate:"Mar 1",lastDate:"Feb 1",price:80,active:false,streak:0,totalVisits:7,nextTime:"4:00 PM"},
  {id:5,client:"Khalil R.",avatar:"K",color:C.blue,service:"Fade",frequency:"Weekly",barber:"Darius",nextDate:"Feb 27",lastDate:"Feb 20",price:35,active:true,streak:4,totalVisits:8,nextTime:"11:00 AM"},
];

// ── EQUIPMENT DATA ──
const EQUIPMENT_INIT=[
  {id:1,name:"Wahl Magic Clip",type:"Clippers",icon:"✂️",barber:"Marcus",lastService:"Jan 15",nextService:"Mar 15",bladesChanged:"Feb 1",bladeInterval:30,oilInterval:7,lastOiled:"Feb 18",health:92,notes:"Running smooth",serviceCount:24},
  {id:2,name:"Andis Master",type:"Clippers",icon:"✂️",barber:"Darius",lastService:"Dec 20",nextService:"Feb 20",bladesChanged:"Jan 10",bladeInterval:30,oilInterval:7,lastOiled:"Feb 15",health:61,notes:"Slight vibration — check screws",serviceCount:18},
  {id:3,name:"Wahl Senior",type:"Clippers",icon:"✂️",barber:"Jerome",lastService:"Feb 5",nextService:"Apr 5",bladesChanged:"Feb 5",bladeInterval:30,oilInterval:7,lastOiled:"Feb 19",health:97,notes:"",serviceCount:12},
  {id:4,name:"Straight Razor — Set A",type:"Razor",icon:"🪒",barber:"Marcus",lastService:"Feb 10",nextService:"Feb 24",bladesChanged:"Feb 10",bladeInterval:14,oilInterval:0,lastOiled:null,health:78,notes:"Replace blade set on next service",serviceCount:30},
  {id:5,name:"Barber Chair #1",type:"Chair",icon:"💺",barber:"Marcus",lastService:"Nov 10",nextService:"May 10",bladesChanged:null,bladeInterval:0,oilInterval:30,lastOiled:"Jan 10",health:85,notes:"Hydraulic feels slightly stiff",serviceCount:0},
  {id:6,name:"UV Sterilizer",type:"Sanitization",icon:"☀️",barber:"All",lastService:"Jan 1",nextService:"Jul 1",bladesChanged:null,bladeInterval:0,oilInterval:0,lastOiled:null,health:100,notes:"Bulb replaced Jan 1",serviceCount:0},
];
const MAINT_LOGS=[
  {equip:"Wahl Magic Clip",action:"Blade change + oil",date:"Feb 1",by:"Marcus",note:""},
  {equip:"Andis Master",action:"Full clean + oil",date:"Feb 15",by:"Darius",note:"Noticed slight vibration"},
  {equip:"Straight Razor Set A",action:"Blade replacement",date:"Feb 10",by:"Marcus",note:"Used last blade from pack — reorder"},
  {equip:"UV Sterilizer",action:"Bulb replacement",date:"Jan 1",by:"Marcus",note:""},
];

// ── TIME CLOCK DATA ──
const TIMECLOCK_BARBERS=[
  {id:1,name:"Marcus J.",avatar:"M",color:C.gold,clockedIn:true,clockInTime:"9:02 AM",hoursToday:1.65,hoursWeek:18.3,overtimeHours:0},
  {id:2,name:"Darius B.",avatar:"D",color:C.blue,clockedIn:true,clockInTime:"9:15 AM",hoursToday:1.42,hoursWeek:16.7,overtimeHours:0},
  {id:3,name:"Jerome W.",avatar:"J",color:C.green,clockedIn:false,clockInTime:null,hoursToday:0,hoursWeek:14.2,overtimeHours:0},
];
const SHIFT_LOG=[
  {barber:"Marcus",date:"Feb 20",in:"9:02 AM",out:"—",hours:"1h 39m",status:"active"},
  {barber:"Darius",date:"Feb 20",in:"9:15 AM",out:"—",hours:"1h 26m",status:"active"},
  {barber:"Marcus",date:"Feb 19",in:"9:00 AM",out:"6:30 PM",hours:"9h 30m",status:"done"},
  {barber:"Darius",date:"Feb 19",in:"9:10 AM",out:"5:45 PM",hours:"8h 35m",status:"done"},
  {barber:"Jerome",date:"Feb 19",in:"11:00 AM",out:"6:00 PM",hours:"7h 00m",status:"done"},
];

// ── V11 DATA ──

// CHAT DATA
const CHAT_CLIENTS=[
  {id:1,name:"Marcus J.",avatar:"M",color:"#C9A84C",lastMsg:"Bet, see you at 10!",time:"9:41 AM",unread:0,online:true,appt:"Today 10:00 AM · Fade + Beard"},
  {id:2,name:"DeShawn W.",avatar:"D",color:"#5B9CF6",lastMsg:"Can I reschedule to Thursday?",time:"Yesterday",unread:2,online:false,appt:"Tomorrow 11:30 AM · Shape-Up"},
  {id:3,name:"Tre L.",avatar:"T",color:"#4CAF7A",lastMsg:"How long is the wait?",time:"Yesterday",unread:1,online:true,appt:"Feb 22 2:00 PM · Braids"},
  {id:4,name:"Carlos M.",avatar:"C",color:"#A78BFA",lastMsg:"Thanks bro, faded clean 🔥",time:"Mon",unread:0,online:false,appt:"Mar 1 3:30 PM · Color"},
  {id:5,name:"Brandon K.",avatar:"B",color:"#F472B6",lastMsg:"Do you do kids cuts?",time:"Sun",unread:0,online:false,appt:"No upcoming"},
];
const CHAT_THREADS={
  1:[
    {id:1,from:"client",text:"Yo Marcus! I'm coming in at 10, just confirming",time:"9:30 AM",type:"text"},
    {id:2,from:"barber",text:"All good bro, I got you down. Come in a little early if you can, I'll get you right",time:"9:35 AM",type:"text"},
    {id:3,from:"client",text:"Bet, see you at 10!",time:"9:41 AM",type:"text"},
  ],
  2:[
    {id:1,from:"barber",text:"Hey DeShawn! Confirming your Shape-Up tomorrow at 11:30 AM 💈",time:"Yesterday 9:00 AM",type:"text"},
    {id:2,from:"client",text:"Hey I actually wanted to ask — can I reschedule to Thursday?",time:"Yesterday 10:14 AM",type:"text"},
    {id:3,from:"client",text:"Same time?",time:"Yesterday 10:15 AM",type:"text"},
  ],
  3:[
    {id:1,from:"client",text:"How long is the wait rn?",time:"Yesterday 2:08 PM",type:"text"},
    {id:2,from:"barber",text:"About 45 min right now. You on the list already?",time:"Yesterday 2:12 PM",type:"text"},
    {id:3,from:"client",text:"Nah I'll just come in",time:"Yesterday 2:18 PM",type:"text"},
    {id:4,from:"barber",text:"Cool, add yourself to the walk-in queue on the Chop-It-Up link so you get your spot 👍",time:"Yesterday 2:19 AM",type:"text"},
  ],
};

// DEPOSIT DATA
const DEPOSITS_INIT=[
  {id:1,client:"Marcus J.",avatar:"M",color:"#C9A84C",service:"Fade + Beard",apptDate:"Today 10:00 AM",depositAmt:20,totalAmt:54,status:"paid",paidDate:"Feb 18",method:"card"},
  {id:2,client:"DeShawn W.",avatar:"D",color:"#5B9CF6",service:"Braids",apptDate:"Feb 22 2:00 PM",depositAmt:40,totalAmt:95,status:"pending",paidDate:null,method:null},
  {id:3,client:"Tre L.",avatar:"T",color:"#4CAF7A",service:"Color + Fade",apptDate:"Mar 1 3:30 PM",depositAmt:30,totalAmt:80,status:"paid",paidDate:"Feb 15",method:"apple"},
  {id:4,client:"Brandon K.",avatar:"B",color:"#F472B6",service:"Shape-Up",apptDate:"Mar 3 5:00 PM",depositAmt:10,totalAmt:30,status:"pending",paidDate:null,method:null},
  {id:5,client:"Carlos M.",avatar:"C",color:"#A78BFA",service:"Fade + Beard",apptDate:"Jan 15 11:00 AM",depositAmt:20,totalAmt:54,status:"refunded",paidDate:"Jan 10",method:"card"},
];

// STAFF SCORECARD DATA
const SCORECARD_BARBERS=[
  {id:1,name:"Marcus J.",avatar:"M",color:"#C9A84C",role:"Owner",
   kpis:{revenue:2840,services:63,avgTicket:45,retention:89,rating:4.9,rebooking:84,noShows:2,newClients:14},
   trend:{revenue:"+18%",services:"+4",rating:"→",rebooking:"+5%"},
   rank:1},
  {id:2,name:"Darius B.",avatar:"D",color:"#5B9CF6",role:"Barber",
   kpis:{revenue:1920,services:44,avgTicket:43,retention:82,rating:4.7,rebooking:76,noShows:4,newClients:9},
   trend:{revenue:"+11%",services:"+2",rating:"↑",rebooking:"+3%"},
   rank:2},
  {id:3,name:"Jerome W.",avatar:"J",color:"#4CAF7A",role:"Barber",
   kpis:{revenue:1540,services:38,avgTicket:40,retention:78,rating:4.6,rebooking:71,noShows:5,newClients:6},
   trend:{revenue:"+7%",services:"-1",rating:"↓",rebooking:"-2%"},
   rank:3},
];

// EMAIL CAMPAIGNS DATA
const CAMPAIGNS_INIT=[
  {id:1,name:"February Flash Sale",type:"Promotion",status:"sent",sentDate:"Feb 10",recipients:189,openRate:64,clickRate:18,unsubRate:0.5,revenue:420},
  {id:2,name:"Win-Back: Lapsed Clients",type:"Automation",status:"active",sentDate:"Ongoing",recipients:32,openRate:48,clickRate:12,unsubRate:1.2,revenue:210},
  {id:3,name:"Monthly Newsletter — Feb",type:"Newsletter",status:"draft",sentDate:null,recipients:0,openRate:0,clickRate:0,unsubRate:0,revenue:0},
  {id:4,name:"New Service Announcement",type:"Promotion",status:"sent",sentDate:"Jan 28",recipients:201,openRate:71,clickRate:24,unsubRate:0.3,revenue:680},
  {id:5,name:"Post-Visit Thank You",type:"Automation",status:"active",sentDate:"Ongoing",recipients:247,openRate:82,clickRate:31,unsubRate:0.1,revenue:0},
];
const EMAIL_TEMPLATES=[
  {id:"promo",label:"Flash Promotion",icon:"⚡",desc:"Limited-time deal with urgency"},
  {id:"newsletter",label:"Newsletter",icon:"📰",desc:"Monthly update & highlights"},
  {id:"winback",label:"Win-Back",icon:"🔄",desc:"Re-engage lapsed clients"},
  {id:"announce",label:"Announcement",icon:"📣",desc:"New service or price update"},
  {id:"birthday",label:"Birthday Offer",icon:"🎂",desc:"Happy birthday + discount"},
  {id:"review",label:"Review Request",icon:"⭐",desc:"Ask for a 5-star review"},
];

// EXPORT DATA
const EXPORT_TYPES=[
  {id:"clients",label:"Client List",icon:"👥",desc:"Names, phones, emails, visit history, loyalty points",formats:["CSV","Excel"],color:"#5B9CF6",size:"~24 KB"},
  {id:"appointments",label:"Appointment History",icon:"📅",desc:"All bookings with dates, services, barbers, status",formats:["CSV","Excel","PDF"],color:"#C9A84C",size:"~142 KB"},
  {id:"revenue",label:"Revenue Report",icon:"💰",desc:"Transactions, payment methods, tips, totals by day",formats:["CSV","Excel","PDF"],color:"#4CAF7A",size:"~88 KB"},
  {id:"payroll",label:"Payroll Summary",icon:"💼",desc:"Per-barber pay stubs and commission breakdown",formats:["CSV","PDF"],color:"#A78BFA",size:"~18 KB"},
  {id:"expenses",label:"Expense Log",icon:"🧾",desc:"All expenses, categories, tax-deductible items",formats:["CSV","Excel"],color:"#F59E0B",size:"~31 KB"},
  {id:"inventory",label:"Inventory Snapshot",icon:"📦",desc:"Current stock levels, reorder history, vendors",formats:["CSV","Excel"],color:"#F472B6",size:"~12 KB"},
];

// ── V12: FRANCHISE / MULTI-LOCATION DATA ──
const LOCATIONS=[
  {id:1,name:"Chop-It-Up Downtown",address:"123 Main St, New Orleans LA",status:"open",barbers:4,todayAppts:18,todayRevenue:720,weekRevenue:4320,rating:4.9,reviews:287,manager:"Marcus J.",phone:"(504) 555-0101",color:C.gold},
  {id:2,name:"Chop-It-Up Uptown",address:"456 Oak Ave, New Orleans LA",status:"open",barbers:3,todayAppts:12,todayRevenue:480,weekRevenue:2880,rating:4.8,reviews:156,manager:"Devon K.",phone:"(504) 555-0202",color:C.blue},
  {id:3,name:"Chop-It-Up Metairie",address:"789 Veterans Blvd, Metairie LA",status:"closed",barbers:2,todayAppts:0,todayRevenue:0,weekRevenue:1540,rating:4.7,reviews:89,manager:"Jaylen M.",phone:"(504) 555-0303",color:C.purple},
];

// ── V12: REFUND DATA ──
const REFUND_INIT=[
  {id:"R001",client:"Marcus Johnson",service:"Premium Fade",barber:"DJ Kool",amount:45,date:"Feb 22",reason:"Unsatisfied with result",status:"pending",payMethod:"Card •••4242"},
  {id:"R002",client:"Aisha Williams",service:"Haircut + Style",barber:"Ray B.",amount:60,date:"Feb 20",reason:"Appointment no-showed by barber",status:"approved",payMethod:"Card •••1337"},
  {id:"R003",client:"Tyrese Brown",service:"Beard Trim",barber:"Mike D.",amount:25,date:"Feb 19",reason:"Double charged",status:"processing",payMethod:"Cash"},
  {id:"R004",client:"Kendra Davis",service:"Silk Press",barber:"DJ Kool",amount:80,date:"Feb 18",reason:"Allergic reaction to product",status:"approved",payMethod:"Card •••9876"},
  {id:"R005",client:"Alex Chen",service:"Haircut",barber:"Ray B.",amount:35,date:"Feb 15",reason:"Wrong cut — miscommunication",status:"denied",payMethod:"Card •••5555"},
];

// ── V12: QR CODE DATA ──
const QR_TYPES=[
  {id:"booking",label:"Book Now",icon:"📅",desc:"Direct link to your booking page",color:C.gold},
  {id:"checkin",label:"Check-In",icon:"✅",desc:"In-shop arrival check-in kiosk",color:C.green},
  {id:"wifi",label:"WiFi",icon:"📶",desc:"Share your shop WiFi easily",color:C.blue},
  {id:"review",label:"Leave Review",icon:"⭐",desc:"Google / Yelp review prompt",color:C.orange},
  {id:"loyalty",label:"Join Loyalty",icon:"🏆",desc:"Clients join your loyalty program",color:C.purple},
  {id:"tip",label:"Tip Barber",icon:"💸",desc:"Cashless tip payment link",color:C.pink},
];

// ── V12: REPORT BUILDER DATA ──
const REPORT_METRICS=[
  {id:"revenue",label:"Revenue",icon:"💰",color:C.green},
  {id:"appts",label:"Appointments",icon:"📅",color:C.blue},
  {id:"newclients",label:"New Clients",icon:"👤",color:C.purple},
  {id:"avgticket",label:"Avg Ticket",icon:"🎫",color:C.gold},
  {id:"tips",label:"Tips",icon:"💸",color:C.pink},
  {id:"noshow",label:"No-Shows",icon:"🚫",color:C.red},
  {id:"retention",label:"Retention",icon:"🔄",color:C.orange},
  {id:"utilization",label:"Occupancy",icon:"💺",color:C.blue},
];
const REPORT_SAMPLE={
  revenue:[420,580,510,720,650,880,760,490,620,700,810,940],
  appts:[14,19,17,24,22,29,25,16,21,23,27,31],
  newclients:[3,5,4,7,6,9,8,4,6,7,8,10],
  avgticket:[30,30,30,30,29,30,30,30,29,30,30,30],
  tips:[42,58,51,72,65,88,76,49,62,70,81,94],
  noshow:[2,1,3,0,2,1,0,2,1,1,0,1],
  retention:[72,74,71,76,75,78,80,77,79,81,82,84],
  utilization:[62,71,68,80,76,85,83,69,75,79,82,88],
};

// ── V12: LOYALTY WALLET DATA ──
const LOYALTY_WALLET={
  points:1250,
  tier:"Gold",
  nextTier:"Platinum",
  nextTierPts:2000,
  visits:24,
  totalSpent:960,
  memberSince:"Mar 2023",
  rewards:[
    {id:1,name:"Free Haircut",pts:500,icon:"✂️",unlocked:true},
    {id:2,name:"50% Off Beard Trim",pts:300,icon:"🧔",unlocked:true},
    {id:3,name:"Free Product (any)",pts:750,icon:"🧴",unlocked:true},
    {id:4,name:"VIP Priority Booking",pts:1000,icon:"👑",unlocked:true},
    {id:5,name:"Free Full Service",pts:1500,icon:"💎",unlocked:false},
    {id:6,name:"Platinum Gift Bag",pts:2000,icon:"🎁",unlocked:false},
  ],
  history:[
    {date:"Feb 22",desc:"Haircut + Fade",pts:+50,balance:1250},
    {date:"Feb 15",desc:"Redeemed: 50% Off Beard",pts:-300,balance:1200},
    {date:"Feb 10",desc:"Referral Bonus",pts:+100,balance:1500},
    {date:"Feb 5",desc:"Beard Trim",pts:+20,balance:1400},
    {date:"Jan 29",desc:"Monthly Bonus",pts:+75,balance:1380},
  ]
};

// ── V13: CONSULTATION FORM DATA ──
const CONSULT_FORMS_INIT=[
  {id:1,client:"Marcus Johnson",appt:"Today 10:00 AM",service:"Fade",status:"completed",submitted:"8:42 AM",hairType:"Coarse",concerns:"None",lastCut:"2 weeks",allergies:""},
  {id:2,client:"Tyrese Brown",appt:"Today 12:00 PM",service:"Haircut",status:"pending",submitted:null,hairType:null,concerns:null,lastCut:null,allergies:null},
  {id:3,client:"Aisha Williams",appt:"Today 2:30 PM",service:"Silk Press",status:"completed",submitted:"7:15 AM",hairType:"Fine",concerns:"Heat damage",lastCut:"6 weeks",allergies:"Sulfates"},
  {id:4,client:"Devon K.",appt:"Tomorrow 11:00 AM",service:"Beard Trim",status:"sent",submitted:null,hairType:null,concerns:null,lastCut:null,allergies:null},
];

// ── V13: BIRTHDAY AUTOMATION DATA ──
const BDAY_CLIENTS=[
  {id:1,name:"Marcus J.",avatar:"M",color:"#C9A84C",bday:"Feb 24",daysUntil:0,phone:"(504) 555-1234",visits:24,lastVisit:"Feb 10",autoSent:true},
  {id:2,name:"Aisha W.",avatar:"A",color:"#F472B6",bday:"Feb 26",daysUntil:2,phone:"(504) 555-5678",visits:18,lastVisit:"Jan 28",autoSent:false},
  {id:3,name:"Devon K.",avatar:"D",color:"#5B9CF6",bday:"Mar 1",daysUntil:5,phone:"(504) 555-8765",visits:31,lastVisit:"Feb 18",autoSent:false},
  {id:4,name:"Kendra D.",avatar:"K",color:"#4CAF7A",bday:"Mar 3",daysUntil:7,phone:"(504) 555-4321",visits:12,lastVisit:"Feb 5",autoSent:false},
  {id:5,name:"Jerome W.",avatar:"J",color:"#A78BFA",bday:"Mar 10",daysUntil:14,phone:"(504) 555-9876",visits:8,lastVisit:"Jan 15",autoSent:false},
  {id:6,name:"Alex C.",avatar:"A",color:"#F59E0B",bday:"Mar 20",daysUntil:24,phone:"(504) 555-2468",visits:5,lastVisit:"Dec 20",autoSent:false},
];
const BDAY_TEMPLATES=[
  {id:"deal",label:"Birthday Deal",icon:"🎂",msg:"Happy Birthday [Name]! 🎉 Treat yourself — enjoy $10 off your next visit this month. Book: chopitup.app/marcus"},
  {id:"free",label:"Free Service Offer",icon:"🎁",msg:"It's your birthday [Name]! 🎂 Come in for a FREE beard trim with any haircut this month. On us! ✂️"},
  {id:"simple",label:"Simple Wish",icon:"❤️",msg:"Happy Birthday [Name]! Wishing you an amazing day. See you in the chair soon! — Marcus & the crew ✂️"},
  {id:"custom",label:"Custom Message",icon:"✏️",msg:""},
];

// ── V13: BEFORE/AFTER REQUEST DATA ──
const STYLE_CATEGORIES=[
  {id:"fade",label:"Fade",icon:"💈",styles:["Skin Fade","Low Fade","Mid Fade","High Fade","Temp Fade"]},
  {id:"cut",label:"Cut",icon:"✂️",styles:["Buzz Cut","Caesar","French Crop","Textured Top","Curly Top"]},
  {id:"beard",label:"Beard",icon:"🧔",styles:["Full Beard","Short Beard","Stubble","Goatee","Lineup"]},
  {id:"design",label:"Design",icon:"⭐",styles:["Line Art","Part Design","Razor Part","Tribal","Custom"]},
];
const BA_REQUESTS_INIT=[
  {id:1,client:"Marcus J.",appt:"Today 10:00AM",service:"Fade + Design",inspoUploaded:true,currentUploaded:true,notes:"Side part with skin fade, keep some length on top",status:"received",barber:"DJ Kool"},
  {id:2,client:"Tyrese B.",appt:"Today 2:00PM",service:"Haircut",inspoUploaded:true,currentUploaded:false,notes:"Looking for a textured crop",status:"pending",barber:"Ray B."},
];

// ── V13: CHAIR RENTAL DATA ──
const CHAIR_RENTERS_INIT=[
  {id:1,chair:"Chair 1",name:"DJ Kool",avatar:"D",color:"#C9A84C",phone:"(504) 555-1111",email:"djkool@email.com",weeklyRent:200,monthlyRent:800,nextDue:"Mar 1",balance:0,status:"active",since:"Jan 2024",paidMonths:13,specialties:["Fades","Designs","Dreads"]},
  {id:2,chair:"Chair 2",name:"Ray B.",avatar:"R",color:"#5B9CF6",phone:"(504) 555-2222",email:"rayb@email.com",weeklyRent:175,monthlyRent:700,nextDue:"Feb 28",balance:-175,status:"overdue",since:"Aug 2024",paidMonths:6,specialties:["Cuts","Beards"]},
  {id:3,chair:"Chair 3",name:"Mike D.",avatar:"M",color:"#4CAF7A",phone:"(504) 555-3333",email:"miked@email.com",weeklyRent:200,monthlyRent:800,nextDue:"Mar 7",balance:0,status:"active",since:"Mar 2025",paidMonths:3,specialties:["Kids","Fades"]},
  {id:4,chair:"Chair 4",name:"",avatar:"",color:"#555",phone:"",email:"",weeklyRent:0,monthlyRent:0,nextDue:"",balance:0,status:"vacant",since:"",paidMonths:0,specialties:[]},
];
const CHAIR_PAYMENTS_INIT=[
  {id:1,renter:"DJ Kool",amount:800,date:"Feb 1",method:"Cash",status:"paid"},
  {id:2,renter:"Ray B.",amount:700,date:"Feb 7",method:"Venmo",status:"overdue"},
  {id:3,renter:"Mike D.",amount:800,date:"Feb 1",method:"Zelle",status:"paid"},
  {id:4,renter:"DJ Kool",amount:800,date:"Jan 1",method:"Cash",status:"paid"},
  {id:5,renter:"Ray B.",amount:700,date:"Jan 7",method:"Cash",status:"paid"},
];

// ── V13: BREAK SCHEDULER DATA ──
const BREAK_BARBERS=[
  {id:1,name:"Marcus",avatar:"M",color:"#C9A84C",shifts:["9AM","10AM","11AM","12PM","1PM","2PM","3PM","4PM","5PM","6PM"],breaks:[{type:"lunch",start:"12PM",dur:1},{type:"break",start:"3PM",dur:0.5}]},
  {id:2,name:"Darius",avatar:"D",color:"#5B9CF6",shifts:["10AM","11AM","12PM","1PM","2PM","3PM","4PM","5PM","6PM","7PM"],breaks:[{type:"lunch",start:"1PM",dur:1}]},
  {id:3,name:"Jerome",avatar:"J",color:"#4CAF7A",shifts:["9AM","10AM","11AM","12PM","1PM","2PM","3PM","4PM","5PM"],breaks:[{type:"break",start:"11AM",dur:0.5},{type:"lunch",start:"2PM",dur:1}]},
];

// ── V14: ACH / BANK PAYOUT DATA ──
const BANK_ACCOUNTS=[
  {id:1,name:"Marcus Johnson",bankName:"Chase Bank",last4:"4821",routing:"021000021",type:"checking",default:true,verified:true,addedOn:"Jan 12, 2026"},
  {id:2,name:"Marcus Johnson",bankName:"Capital One",last4:"9034",routing:"056073502",type:"savings",default:false,verified:true,addedOn:"Nov 5, 2025"},
];
const PAYOUT_HISTORY=[
  {id:"PAY-2026-008",date:"Feb 21, 2026",amount:1840.00,method:"ACH",bank:"Chase ••4821",status:"completed",days:2,desc:"Weekly payout"},
  {id:"PAY-2026-007",date:"Feb 14, 2026",amount:2210.50,method:"ACH",bank:"Chase ••4821",status:"completed",days:2,desc:"Weekly payout"},
  {id:"PAY-2026-006",date:"Feb 7, 2026",amount:1975.00,method:"ACH",bank:"Chase ••4821",status:"completed",days:2,desc:"Weekly payout"},
  {id:"PAY-2026-005",date:"Jan 31, 2026",amount:2400.00,method:"ACH",bank:"Chase ••4821",status:"completed",days:2,desc:"Weekly payout"},
  {id:"PAY-2026-004",date:"Jan 24, 2026",amount:1620.00,method:"ACH",bank:"Chase ••4821",status:"completed",days:2,desc:"Weekly payout"},
  {id:"PAY-2026-003",date:"Jan 17, 2026",amount:890.00,method:"Instant",bank:"Chase ••4821",status:"failed",days:0,desc:"Instant transfer"},
  {id:"PAY-2026-002",date:"Jan 10, 2026",amount:2100.00,method:"ACH",bank:"Chase ••4821",status:"completed",days:2,desc:"Weekly payout"},
];
const PENDING_BALANCE=2640.00;

// ── V14: PRICE OVERRIDE DATA ──
const OVERRIDES_INIT=[
  {id:"OVR-001",barber:"DJ Kool",client:"Marcus J.",service:"Premium Fade",original:65,requested:45,discount:"31%",reason:"Regular client, been coming 3 years",type:"loyalty",status:"pending",time:"9:14 AM",urgent:true},
  {id:"OVR-002",barber:"Ray B.",client:"Walk-in",service:"Haircut",original:40,requested:30,discount:"25%",reason:"First-time visit promo",type:"promo",status:"pending",time:"8:52 AM",urgent:false},
  {id:"OVR-003",barber:"DJ Kool",client:"Tyrese B.",service:"Beard Trim",original:25,requested:0,discount:"100%",reason:"Service was unsatisfactory — redo",type:"comp",status:"approved",time:"Yesterday",urgent:false},
  {id:"OVR-004",barber:"Mike D.",client:"Kendra D.",service:"Kids Cut",original:30,requested:20,discount:"33%",reason:"Military family discount",type:"military",status:"approved",time:"Feb 22",urgent:false},
  {id:"OVR-005",barber:"Ray B.",client:"Alex C.",service:"Full Service",original:85,requested:60,discount:"29%",reason:"Buddy discount",type:"personal",status:"denied",time:"Feb 21",urgent:false},
];

// ── V14: REVENUE BY SERVICE DATA ──
const SERVICE_REVENUE_DATA=[
  {name:"Skin Fade",icon:"💈",revenue:8420,count:187,avg:45,trend:"+12%",color:"#C9A84C",pct:100},
  {name:"Haircut",icon:"✂️",revenue:6240,count:208,avg:30,trend:"+5%",color:"#5B9CF6",pct:74},
  {name:"Beard Trim",icon:"🧔",revenue:3150,count:126,avg:25,trend:"+8%",color:"#4CAF7A",pct:37},
  {name:"Silk Press",icon:"💆",revenue:2800,count:35,avg:80,trend:"+22%",color:"#F472B6",pct:33},
  {name:"Dreads/Locs",icon:"🪱",revenue:2400,count:24,avg:100,trend:"+18%",color:"#A78BFA",pct:28},
  {name:"Color",icon:"🎨",revenue:1920,count:16,avg:120,trend:"+31%",color:"#F59E0B",pct:23},
  {name:"Kids Cut",icon:"👦",revenue:1680,count:84,avg:20,trend:"+3%",color:"#34D399",pct:20},
  {name:"Line Up",icon:"📐",revenue:1260,count:126,avg:10,trend:"-2%",color:"#FB923C",pct:15},
];
const SVC_BARBER_BREAKDOWN={
  "Skin Fade":{"Marcus":3840,"DJ Kool":2860,"Ray B.":1720},
  "Haircut":{"Marcus":2100,"DJ Kool":2400,"Ray B.":1740},
  "Beard Trim":{"Marcus":980,"DJ Kool":1250,"Ray B.":920},
  "Silk Press":{"Marcus":2800,"DJ Kool":0,"Ray B.":0},
  "Color":{"Marcus":1920,"DJ Kool":0,"Ray B.":0},
};

// ── V14: OCCUPANCY / UTILIZATION DATA ──
const OCC_DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const OCC_HOURS=["9A","10A","11A","12P","1P","2P","3P","4P","5P","6P","7P"];
// Occupancy percentage per [day][hour] 0-100
const OCC_MATRIX=[
  [20,55,70,80,65,45,30,55,70,60,40],   // Mon
  [30,60,85,90,80,70,60,75,85,70,50],   // Tue
  [25,50,75,88,78,68,55,65,80,65,45],   // Wed
  [35,65,82,92,85,72,65,78,88,75,55],   // Thu
  [50,75,90,95,90,85,80,88,95,90,70],   // Fri
  [80,95,100,100,98,96,92,95,100,95,85], // Sat
  [20,40,55,60,50,35,25,30,40,25,15],   // Sun
];
const BARBER_UTIL=[
  {name:"Marcus",color:"#C9A84C",utilization:87,slotsUsed:43,totalSlots:50,peak:"Fri-Sat",topService:"Skin Fade"},
  {name:"DJ Kool",color:"#5B9CF6",utilization:74,slotsUsed:37,totalSlots:50,peak:"Thu-Fri",topService:"Haircut"},
  {name:"Jerome",color:"#4CAF7A",utilization:62,slotsUsed:31,totalSlots:50,peak:"Sat",topService:"Beard Trim"},
];

// ── SHARED HELPERS ──
function Tog({on,toggle}){return <div className={`tgl${on?" on":""}`} onClick={toggle}><div className="tth"/></div>;}
function Stars({n,count,size=14}){
  const filled=n??count??0;
  return <div style={{display:"flex",gap:2}}>{[1,2,3,4,5].map(s=><span key={s} style={{fontSize:size,filter:s<=filled?"none":"grayscale(100%)",opacity:s<=filled?1:.3}}>⭐</span>)}</div>;
}
function TierBadge({tier}){
  const colors={Bronze:"#CD7F32",Silver:"#9E9E9E",Gold:C.gold,Platinum:"#C8D8FF"};
  return <span style={{fontSize:11,fontWeight:700,color:colors[tier]||C.muted,background:`${colors[tier]}18`,border:`1px solid ${colors[tier]}44`,borderRadius:20,padding:"2px 8px"}}>{tier}</span>;
}
function Chip({label,active,onClick}){
  return <div onClick={onClick} style={{display:"inline-block",padding:"6px 14px",borderRadius:20,border:`1px solid ${active?C.gold:C.border}`,background:active?"rgba(201,168,76,.1)":C.surface,color:active?C.gold:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",transition:"all .2s"}}>{label}</div>;
}
function Toast({msg}){
  if(!msg)return null;
  return <div className="toast">✓ {msg}</div>;
}
function SkeletonCard(){
  return <div className="card" style={{marginBottom:10}}>
    <div style={{display:"flex",gap:12,alignItems:"center"}}>
      <div className="skel" style={{width:44,height:44,borderRadius:"50%"}}/>
      <div style={{flex:1}}>
        <div className="skel" style={{height:14,width:"60%",marginBottom:8}}/>
        <div className="skel" style={{height:11,width:"40%"}}/>
      </div>
    </div>
  </div>;
}

// ══════════════════════════════════════════
// SPLASH SCREEN
// ══════════════════════════════════════════
function SplashScreen({onDone}){
  const [exiting,setExiting]=useState(false);
  useEffect(()=>{
    const t=setTimeout(()=>{setExiting(true);setTimeout(onDone,400);},2400);
    return()=>clearTimeout(t);
  },[]);
  return(
    <div className={`splash${exiting?" splash-exit":""}`}>
      <div className="auth-bg"/>
      <div className="splash-logo">
        <div className="splash-ring">
          <div className="scissor-spin" style={{fontSize:48}}>✂️</div>
        </div>
        <h1 className="pf" style={{fontSize:36,fontWeight:700,color:C.gold,textAlign:"center",letterSpacing:-0.5}}>Chop-It-Up</h1>
      </div>
      <p className="splash-sub" style={{fontSize:14,color:C.muted,marginTop:8,letterSpacing:1.5,textTransform:"uppercase"}}>Barber Business Platform</p>
      <div className="splash-bar">
        <div className="splash-progress">
          <div className="splash-progress-fill"/>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// AUTH SCREEN (Login / Sign Up)
// ══════════════════════════════════════════
function AuthScreen({onAuth}){
  const [tab,setTab]=useState("login");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [name,setName]=useState("");
  const [role,setRole]=useState("barber");
  const [loading,setLoading]=useState(false);
  const [oauthLoading,setOauthLoading]=useState(""); // "google" | "apple" | ""
  const [err,setErr]=useState("");
  const [showSetupTip,setShowSetupTip]=useState(false);

  // ── Google Sign-In ──
  const handleGoogleSignIn=async()=>{
    const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if(!clientId){
      setErr("Google Sign-In is not configured yet. Add VITE_GOOGLE_CLIENT_ID to your .env.local file. See setup instructions below.");
      setShowSetupTip(true);
      return;
    }
    setOauthLoading("google");
    setErr("");
    try{
      await loadScript("https://accounts.google.com/gsi/client","gsi-script");
      await new Promise((resolve,reject)=>{
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async(response)=>{
            try{
              const payload=decodeJWT(response.credential);
              const user=await ParseService.oauthFindOrCreate({
                email: payload.email,
                name:  payload.name || payload.given_name || payload.email.split("@")[0],
                provider:"google",
              });
              onAuth(user.get("role")||"barber");
              resolve();
            } catch(e){ reject(e); }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.prompt(notification=>{
          if(notification.isNotDisplayed()||notification.isSkippedMoment()){
            // Fallback: open the full popup
            window.google.accounts.id.renderButton(
              document.getElementById("google-btn-target"),
              {theme:"filled_black",size:"large",width:340}
            );
            reject(new Error("USE_BUTTON"));
          }
        });
      });
    } catch(e){
      if(e.message!=="USE_BUTTON"){
        setErr(e.message||"Google sign-in failed. Please try again.");
      }
    } finally { setOauthLoading(""); }
  };

  // ── Apple Sign-In ──
  const handleAppleSignIn=async()=>{
    const serviceId=import.meta.env.VITE_APPLE_SERVICE_ID;
    const redirectUri=import.meta.env.VITE_APPLE_REDIRECT_URI||window.location.origin;
    if(!serviceId){
      setErr("Apple Sign-In is not configured yet. Add VITE_APPLE_SERVICE_ID to your .env.local file. See setup instructions below.");
      setShowSetupTip(true);
      return;
    }
    setOauthLoading("apple");
    setErr("");
    try{
      await loadScript(
        "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js",
        "apple-id-script"
      );
      window.AppleID.auth.init({
        clientId:    serviceId,
        scope:       "name email",
        redirectURI: redirectUri,
        usePopup:    true,
      });
      const response=await window.AppleID.auth.signIn();
      const id_token=response?.authorization?.id_token;
      if(!id_token) throw new Error("No token returned from Apple.");
      const payload=decodeJWT(id_token);
      const email=payload.email||payload.sub+"@appleid.com";
      // Apple only returns name on first sign-in
      const firstName=response?.user?.name?.firstName||"";
      const lastName=response?.user?.name?.lastName||"";
      const fullName=`${firstName} ${lastName}`.trim()||email.split("@")[0];
      const user=await ParseService.oauthFindOrCreate({email, name:fullName, provider:"apple"});
      onAuth(user.get("role")||"barber");
    } catch(e){
      if(e.error==="popup_closed_by_user"||e.error==="user_trigger_new_sign_in_flow") return;
      setErr(e.message||"Apple sign-in failed. Please try again.");
    } finally { setOauthLoading(""); }
  };

  // ── Email/Password ──
  const handleSubmit=async()=>{
    setErr(""); setShowSetupTip(false);
    if(!email){setErr("Email is required");return;}
    if(!pass){setErr("Password is required");return;}
    if(tab==="signup"&&!name){setErr("Name is required");return;}
    if(pass.length<6){setErr("Password must be at least 6 characters");return;}
    setLoading(true);
    try{
      if(tab==="signup"){
        await ParseService.signUp(email, pass, name, role);
        onAuth(role);
      } else {
        const user = await ParseService.logIn(email, pass);
        onAuth(user.get("role")||"barber");
      }
    } catch(e){
      const msg=e.message||"";
      const code=e.code||0;
      if(code===101||msg.toLowerCase().includes("invalid username/password")||msg.toLowerCase().includes("invalid credentials")){
        setErr("Incorrect email or password.");
      } else if(code===202||msg.includes("already taken")||msg.includes("already exists")){
        setErr("An account with this email already exists. Try signing in instead.");
      } else if(code===401||msg.toLowerCase().includes("unauthorized")){
        setErr("Sign-up is blocked by your Back4App security settings.");
        setShowSetupTip(true);
      } else if(code===209||msg.toLowerCase().includes("session")){
        setErr("Session expired. Please try again.");
      } else if(msg.includes("username")){
        setErr("Invalid email address.");
      } else {
        setErr(msg||"Something went wrong. Please try again.");
      }
    } finally { setLoading(false); }
  };

  const handleForgotPassword=async()=>{
    if(!email){setErr("Enter your email above first");return;}
    setLoading(true);
    try{
      await ParseService.resetPassword(email);
      setErr("✓ Reset email sent — check your inbox.");
    } catch(e){
      setErr(e.message||"Could not send reset email.");
    } finally { setLoading(false); }
  };

  return(
    <div className="auth screen-enter">
      <div className="auth-bg"/>
      <div className="auth-bg2"/>
      {/* Logo area */}
      <div style={{padding:"60px 24px 32px",textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:72,height:72,borderRadius:22,background:"rgba(201,168,76,.1)",border:"1px solid rgba(201,168,76,.2)",marginBottom:20,fontSize:32}}>✂️</div>
        <h1 className="pf" style={{fontSize:30,fontWeight:700,color:C.gold}}>Chop-It-Up</h1>
        <p style={{fontSize:13,color:C.muted,marginTop:4}}>The barber business platform</p>
      </div>

      {/* Auth card */}
      <div className="auth-card">
        {/* Tab switcher */}
        <div style={{display:"flex",background:C.card,borderRadius:12,padding:4,gap:4,marginBottom:24}}>
          {["login","signup"].map(t=>(
            <div key={t} className={`auth-tab${tab===t?" act":""}`} onClick={()=>{setTab(t);setErr("");}}>
              {t==="login"?"Sign In":"Create Account"}
            </div>
          ))}
        </div>

        {/* Social login */}
        <button className="social-btn" style={{marginBottom:10,opacity:oauthLoading==="apple"?.7:1}} onClick={handleAppleSignIn} disabled={!!oauthLoading||loading}>
          {oauthLoading==="apple"
            ? <span style={{display:"flex",alignItems:"center",gap:8}}><span style={{animation:"scissors 1s linear infinite",display:"inline-block"}}>✂️</span> Signing in…</span>
            : <><span style={{fontSize:18}}>🍎</span> Continue with Apple</>}
        </button>
        <button className="social-btn" onClick={handleGoogleSignIn} disabled={!!oauthLoading||loading} style={{opacity:oauthLoading==="google"?.7:1}}>
          {oauthLoading==="google"
            ? <span style={{display:"flex",alignItems:"center",gap:8}}><span style={{animation:"scissors 1s linear infinite",display:"inline-block"}}>✂️</span> Signing in…</span>
            : <><span style={{fontSize:18,fontWeight:700,fontFamily:"serif",color:"#4285F4"}}>G</span> Continue with Google</>}
        </button>
        {/* Hidden target for Google button fallback */}
        <div id="google-btn-target" style={{marginTop:4}}/>

        {/* Back4App setup tip — shown when unauthorized error occurs */}
        {showSetupTip&&(
          <div style={{background:"rgba(91,156,246,.08)",border:"1px solid rgba(91,156,246,.25)",borderRadius:12,padding:14,marginTop:10}}>
            <p style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:8}}>🔧 Back4App Setup Required</p>
            <p style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:6}}>
              To fix the "unauthorized" error, go to your Back4App dashboard:
            </p>
            {[
              "1. Open your app → Server Settings",
              "2. Turn ON "Allow Client Class Creation"",
              "3. Go to Database → _User class → Class Level Permissions",
              "4. Set Create + Add Fields to Public (unauthenticated)",
              "5. Save and retry sign-up",
            ].map((s,i)=>(
              <p key={i} style={{fontSize:11,color:C.muted,lineHeight:1.8}}>{s}</p>
            ))}
            <p style={{fontSize:11,color:C.muted,marginTop:6}}>
              For OAuth: add <span style={{color:C.gold}}>VITE_GOOGLE_CLIENT_ID</span> and <span style={{color:C.gold}}>VITE_APPLE_SERVICE_ID</span> to your .env.local
            </p>
          </div>
        )}

        <div className="divider">
          <div className="divider-line"/>
          <span className="divider-txt">or with email</span>
          <div className="divider-line"/>
        </div>

        {/* Form */}
        {tab==="signup"&&(
          <div style={{marginBottom:12}}>
            <label className="lbl">Full Name</label>
            <input className="inp" placeholder="Marcus Johnson" value={name} onChange={e=>setName(e.target.value)}/>
          </div>
        )}
        <div style={{marginBottom:12}}>
          <label className="lbl">Email</label>
          <input className="inp" placeholder="you@example.com" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
        </div>
        <div style={{marginBottom:tab==="signup"?12:20}}>
          <label className="lbl">Password</label>
          <input className="inp" placeholder="••••••••" type="password" value={pass} onChange={e=>setPass(e.target.value)}/>
        </div>

        {/* Role selection for signup */}
        {tab==="signup"&&(
          <div style={{marginBottom:20}}>
            <label className="lbl" style={{marginBottom:10}}>I am a...</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[{id:"barber",icon:"💈",label:"Barber",sub:"I cut hair"},{id:"owner",icon:"🏪",label:"Shop Owner",sub:"I own the shop"}].map(r=>(
                <div key={r.id} className={`role-card${role===r.id?" sel":""}`} onClick={()=>setRole(r.id)}>
                  <div style={{fontSize:26,marginBottom:6}}>{r.icon}</div>
                  <p style={{fontSize:14,fontWeight:700,color:role===r.id?C.gold:C.text}}>{r.label}</p>
                  <p style={{fontSize:11,color:C.muted}}>{r.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {err&&<p style={{fontSize:12,color:C.red,marginBottom:12,textAlign:"center"}}>{err}</p>}

        <button className="btn bg" onClick={handleSubmit} disabled={loading} style={{marginBottom:16}}>
          {loading?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><span style={{animation:"scissors 1s linear infinite",display:"inline-block"}}>✂️</span> {tab==="login"?"Signing In...":"Creating Account..."}</span>:(tab==="login"?"Sign In →":"Create Account →")}
        </button>

        {tab==="login"&&<p style={{textAlign:"center",fontSize:12,color:C.muted}}>Forgot password? <span style={{color:C.gold,cursor:"pointer"}} onClick={handleForgotPassword}>Reset it</span></p>}
        {tab==="signup"&&<p style={{textAlign:"center",fontSize:11,color:C.dim,lineHeight:1.5}}>By continuing, you agree to our <span style={{color:C.gold}}>Terms</span> and <span style={{color:C.gold}}>Privacy Policy</span></p>}

        {/* Demo shortcut */}
        <div style={{marginTop:20,padding:"12px",background:"rgba(201,168,76,.05)",border:"1px dashed rgba(201,168,76,.2)",borderRadius:10,textAlign:"center"}}>
          <p style={{fontSize:11,color:C.muted,marginBottom:6}}>Just want to explore?</p>
          <button onClick={()=>onAuth("barber")} style={{background:"none",border:"none",color:C.gold,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Enter as Demo Barber →</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// ONBOARDING FLOW (5 steps)
// ══════════════════════════════════════════
function OnboardingScreen({onDone}){
  const [step,setStep]=useState(0);
  const [shopName,setShopName]=useState("");
  const [location,setLocation]=useState("");
  const [phone,setPhone]=useState("");
  const [bio,setBio]=useState("");
  const [workDays,setWorkDays]=useState(["Mon","Tue","Wed","Thu","Fri","Sat"]);
  const [startTime,setStartTime]=useState("9:00 AM");
  const [endTime,setEndTime]=useState("7:00 PM");
  const [prices,setPrices]=useState({Haircut:"30",Fade:"40","Beard Trim":"20","Shape-Up":"25","Fade + Beard":"55",Color:"70",Braids:"95"});
  const [payoutMethod,setPayoutMethod]=useState("stripe");

  const STEPS_META=[
    {icon:"🏪",title:"Your Shop",sub:"Let's set up your barbershop profile"},
    {icon:"📅",title:"Hours & Schedule",sub:"When do you take appointments?"},
    {icon:"✂️",title:"Your Services",sub:"What do you offer? Set your prices"},
    {icon:"💳",title:"Get Paid",sub:"Connect how you want to receive money"},
    {icon:"🚀",title:"You're Ready!",sub:"Your shop is set up and ready to go"},
  ];
  const DAYS_OF_WEEK=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  const toggleDay=d=>setWorkDays(ds=>ds.includes(d)?ds.filter(x=>x!==d):[...ds,d]);

  const TOTAL=STEPS_META.length;

  return(
    <div className="ob-step screen-enter">
      <div className="ob-bg"/>
      {/* Header */}
      <div style={{padding:"56px 24px 0",display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        {step>0&&step<TOTAL-1&&<button onClick={()=>setStep(s=>s-1)} style={{background:"none",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"7px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>←</button>}
        <div style={{flex:1}}>
          <div className="ob-progress">
            {STEPS_META.map((_,i)=>(
              <div key={i} className={`ob-dot${i===step?" act":i<step?" done":""}`}/>
            ))}
          </div>
        </div>
        {step<TOTAL-1&&<span style={{fontSize:12,color:C.muted,flexShrink:0}}>{step+1} / {TOTAL-1}</span>}
      </div>

      <div style={{padding:"0 24px",flex:1,overflowY:"auto",paddingBottom:120}}>
        <div className="ob-icon-ring">{STEPS_META[step].icon}</div>
        <h2 className="pf" style={{fontSize:28,fontWeight:700,marginBottom:6}}>{STEPS_META[step].title}</h2>
        <p style={{fontSize:14,color:C.muted,marginBottom:28,lineHeight:1.5}}>{STEPS_META[step].sub}</p>

        {/* Step 0: Shop Profile */}
        {step===0&&<>
          <div style={{marginBottom:14}}>
            <label className="lbl">Shop / Barber Name</label>
            <input className="inp" placeholder="Marcus Cuts" value={shopName} onChange={e=>setShopName(e.target.value)}/>
          </div>
          <div style={{marginBottom:14}}>
            <label className="lbl">City & State</label>
            <input className="inp" placeholder="New Orleans, LA" value={location} onChange={e=>setLocation(e.target.value)}/>
          </div>
          <div style={{marginBottom:14}}>
            <label className="lbl">Business Phone</label>
            <input className="inp" placeholder="(504) 555-0000" type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/>
          </div>
          <div style={{marginBottom:14}}>
            <label className="lbl">Short Bio (shown on booking page)</label>
            <textarea className="txa" placeholder="10 years cutting in NOLA. Specializing in fades, shapes, and braids..." value={bio} onChange={e=>setBio(e.target.value)} style={{minHeight:80}}/>
          </div>
        </>}

        {/* Step 1: Hours */}
        {step===1&&<>
          <p className="stit">Working Days</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:24}}>
            {DAYS_OF_WEEK.map(d=>(
              <div key={d} className={`day-chip${workDays.includes(d)?" sel":""}`} onClick={()=>toggleDay(d)}>{d[0]}</div>
            ))}
          </div>
          <p className="stit">Hours</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
            <div>
              <label className="lbl">Opens at</label>
              <select className="sel" value={startTime} onChange={e=>setStartTime(e.target.value)}>
                {["7:00 AM","8:00 AM","9:00 AM","10:00 AM"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Closes at</label>
              <select className="sel" value={endTime} onChange={e=>setEndTime(e.target.value)}>
                {["5:00 PM","6:00 PM","7:00 PM","8:00 PM","9:00 PM"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="card" style={{background:"rgba(201,168,76,.05)",borderColor:"rgba(201,168,76,.2)"}}>
            <p style={{fontSize:13,color:C.muted,marginBottom:4}}>📅 Your schedule preview</p>
            <p style={{fontSize:14,fontWeight:600}}>{workDays.join(", ")}</p>
            <p style={{fontSize:13,color:C.gold}}>{startTime} – {endTime}</p>
          </div>
        </>}

        {/* Step 2: Services & Prices */}
        {step===2&&<>
          <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Toggle services on/off and set your prices.</p>
          {Object.entries(prices).map(([svc,price])=>(
            <div key={svc} className="svc-row">
              <div style={{flex:1}}>
                <p style={{fontSize:14,fontWeight:600}}>{svc}</p>
                <p style={{fontSize:11,color:C.muted}}>{SVCS.find(s=>s.name===svc)?.dur||""}</p>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:13,color:C.muted}}>$</span>
                <input
                  className="price-inp"
                  type="number"
                  value={price}
                  onChange={e=>setPrices(p=>({...p,[svc]:e.target.value}))}
                />
              </div>
            </div>
          ))}
        </>}

        {/* Step 3: Payouts */}
        {step===3&&<>
          <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Choose how you want to accept payments and get paid.</p>
          {[
            {id:"stripe",icon:"💳",label:"Stripe",sub:"Card reader + online payments. Lowest fees."},
            {id:"cash",icon:"💵",label:"Cash Only",sub:"Track manually. No processing fees."},
            {id:"both",icon:"🔄",label:"Both",sub:"Accept cards + track cash together"},
          ].map(m=>(
            <div key={m.id} className={`role-card${payoutMethod===m.id?" sel":""}`} style={{textAlign:"left",display:"flex",gap:14,alignItems:"center",marginBottom:10,padding:"16px"}} onClick={()=>setPayoutMethod(m.id)}>
              <span style={{fontSize:28,flexShrink:0}}>{m.icon}</span>
              <div style={{flex:1}}>
                <p style={{fontSize:15,fontWeight:700,color:payoutMethod===m.id?C.gold:C.text}}>{m.label}</p>
                <p style={{fontSize:12,color:C.muted}}>{m.sub}</p>
              </div>
              <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${payoutMethod===m.id?C.gold:C.border}`,background:payoutMethod===m.id?C.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {payoutMethod===m.id&&<div style={{width:7,height:7,borderRadius:"50%",background:"#0D0D0D"}}/>}
              </div>
            </div>
          ))}
          {payoutMethod!=="cash"&&(
            <div style={{marginTop:16,padding:14,background:"rgba(91,156,246,.06)",border:"1px solid rgba(91,156,246,.2)",borderRadius:12}}>
              <p style={{fontSize:13,fontWeight:600,color:C.blue,marginBottom:4}}>🔗 Connect Stripe</p>
              <p style={{fontSize:12,color:C.muted}}>You'll be redirected to Stripe to securely connect your bank account. Takes 2 minutes.</p>
            </div>
          )}
        </>}

        {/* Step 4: Done */}
        {step===TOTAL-1&&(
          <div style={{textAlign:"center",paddingTop:20}}>
            <div style={{fontSize:64,marginBottom:24,animation:"bounce 1s ease infinite alternate",display:"inline-block"}}>🎉</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,marginBottom:28}}>
              {[
                {icon:"🔗",label:"Your booking link is live",val:"chopitup.app/marcus"},
                {icon:"📅",label:"Schedule ready",val:`${workDays.length} days / week`},
                {icon:"✂️",label:"Services listed",val:`${Object.keys(prices).length} services`},
                {icon:"💳",label:"Payment method",val:payoutMethod==="stripe"?"Stripe connected":payoutMethod==="cash"?"Cash tracking":"Stripe + Cash"},
              ].map(item=>(
                <div key={item.icon} style={{background:C.card,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,border:`1px solid ${C.border}`,textAlign:"left"}}>
                  <span style={{fontSize:20}}>{item.icon}</span>
                  <div style={{flex:1}}>
                    <p style={{fontSize:12,color:C.muted}}>{item.label}</p>
                    <p style={{fontSize:13,fontWeight:700,color:C.gold}}>{item.val}</p>
                  </div>
                  <span style={{color:C.green,fontSize:16}}>✓</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,padding:"20px 24px 36px",background:`linear-gradient(180deg,transparent,${C.bg} 40%)`,zIndex:10}}>
        <button className="btn bg" onClick={step===TOTAL-1?()=>onDone({shopName,barberName:shopName,location,phone}):()=>setStep(s=>s+1)} style={{fontSize:15}}>
          {step===TOTAL-1?"🚀  Launch My Shop":"Continue →"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// CLIENT BOOKING PAGE (public-facing)
// ══════════════════════════════════════════
function ClientBookingPage({onClose}){
  const [step,setStep]=useState(0); // 0=services, 1=date/time, 2=info, 3=confirm, 4=success
  const [selSvc,setSelSvc]=useState(null);
  const [selDate,setSelDate]=useState(0);
  const [selTime,setSelTime]=useState(null);
  const [clientName,setClientName]=useState("");
  const [clientPhone,setClientPhone]=useState("");
  const [clientNote,setClientNote]=useState("");
  const [promoCode,setPromoCode]=useState("");
  const [promoApplied,setPromoApplied]=useState(false);
  const dates=getCalendarDates();

  const discount=promoApplied&&selSvc?5:0;
  const finalPrice=selSvc?(selSvc.price-discount):0;

  const applyPromo=()=>{
    if(promoCode.toUpperCase()==="LOVE5"||promoCode.toUpperCase()==="NEW5") setPromoApplied(true);
  };

  const BARBER={name:"Marcus Johnson",rating:4.9,reviews:124,location:"New Orleans, LA",avatar:"M",bio:"10 years cutting in NOLA. Clean fades, sharp shapes, and expert braids. Book and I'll see you in the chair ✂️"};

  const stepTitles=["Choose a Service","Pick a Date & Time","Your Info","Confirm Booking"];

  if(step===4) return(
    <div className="modfull" style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}>
      <div className="booking-success">
        <div className="confetti-icon">🎉</div>
        <h2 className="pf" style={{fontSize:28,fontWeight:700,marginTop:20,marginBottom:8}}>You're booked!</h2>
        <p style={{fontSize:15,color:C.muted,marginBottom:28,lineHeight:1.5}}>See you {dates[selDate].full} at {selTime}.<br/>Marcus will see you soon.</p>
        <div className="booking-confirm" style={{width:"100%",marginBottom:24}}>
          {[["👤",clientName],["✂️",selSvc?.name],["📅",`${dates[selDate].full} · ${selTime}`],["💰",`$${finalPrice}${promoApplied?" (promo applied)":""}`]].map(([icon,val])=>(
            <div key={icon} style={{display:"flex",gap:12,alignItems:"center",padding:"8px 0",borderBottom:`1px solid rgba(201,168,76,.1)`}}>
              <span style={{fontSize:16}}>{icon}</span>
              <span style={{fontSize:14,fontWeight:500}}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <button className="bo" style={{fontSize:13,padding:"12px"}}>📅 Add to Calendar</button>
          <button className="btn bg" style={{fontSize:13}} onClick={onClose}>Done</button>
        </div>
        <p style={{fontSize:12,color:C.muted,textAlign:"center"}}>Confirmation sent to {clientPhone||"your phone"}</p>
      </div>
    </div>
  );

  return(
    <div className="modfull booking">
      {/* Top bar */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px",borderBottom:`1px solid ${C.border}`,background:"rgba(13,13,13,.95)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:10}}>
        {step>0?(
          <button onClick={()=>setStep(s=>s-1)} style={{background:"none",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"7px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>←</button>
        ):(
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"7px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✕</button>
        )}
        <div style={{flex:1}}>
          <p style={{fontSize:13,fontWeight:600}}>{step<4?stepTitles[step]:""}</p>
          <div style={{display:"flex",gap:4,marginTop:6}}>
            {[0,1,2,3].map(i=>(
              <div key={i} style={{height:2,flex:1,borderRadius:1,background:i<=step?C.gold:C.border,transition:"background .3s"}}/>
            ))}
          </div>
        </div>
        <span style={{fontSize:12,color:C.muted}}>{step+1}/4</span>
      </div>

      {/* Step 0: Barber profile + services */}
      {step===0&&(
        <div className="screen-enter" style={{paddingBottom:100}}>
          {/* Barber hero */}
          <div className="booking-hero">
            <div style={{display:"flex",gap:16,alignItems:"flex-start",marginBottom:16}}>
              <div className="pav" style={{width:72,height:72,fontSize:28,flexShrink:0}}>{BARBER.avatar}</div>
              <div style={{flex:1}}>
                <h2 className="pf" style={{fontSize:22,fontWeight:700}}>{BARBER.name}</h2>
                <p style={{fontSize:12,color:C.muted,marginBottom:6}}>{BARBER.location}</p>
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  <span style={{color:C.gold,fontSize:13}}>★ {BARBER.rating}</span>
                  <span style={{fontSize:12,color:C.muted}}>({BARBER.reviews} reviews)</span>
                  <span className="badge bgrn" style={{fontSize:10,marginLeft:4}}>Accepting</span>
                </div>
              </div>
            </div>
            <p style={{fontSize:13,color:C.muted,lineHeight:1.6,fontStyle:"italic"}}>"{BARBER.bio}"</p>
          </div>

          {/* Services */}
          <div style={{padding:"20px 20px 0"}}>
            <p className="stit">Choose a Service</p>
            {SVCS.map(svc=>(
              <div key={svc.name} className={`svc-card${selSvc?.name===svc.name?" sel":""}`} style={{marginBottom:10}} onClick={()=>setSelSvc(svc)}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:44,height:44,borderRadius:14,background:"rgba(201,168,76,.1)",border:"1px solid rgba(201,168,76,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{svc.icon}</div>
                  <div style={{flex:1}}>
                    <p style={{fontSize:15,fontWeight:700}}>{svc.name}</p>
                    <p style={{fontSize:12,color:C.muted}}>{svc.desc}</p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{fontSize:16,fontWeight:700,color:selSvc?.name===svc.name?C.gold:C.text}}>${svc.price}</p>
                    <p style={{fontSize:11,color:C.muted}}>{svc.dur}</p>
                  </div>
                </div>
                {selSvc?.name===svc.name&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(201,168,76,.15)",display:"flex",justifyContent:"flex-end"}}>
                    <span style={{fontSize:12,color:C.gold,fontWeight:600}}>✓ Selected</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Date & Time */}
      {step===1&&(
        <div className="screen-enter" style={{padding:"20px 20px",paddingBottom:100}}>
          <p className="stit">Select a Date</p>
          <div className="date-scroll">
            {dates.map((d,i)=>(
              <div key={i} className={`date-chip${selDate===i?" sel":""}${!d.available?" taken":""}`} onClick={()=>d.available&&setSelDate(i)}
                style={{opacity:d.available?1:.3,cursor:d.available?"pointer":"not-allowed"}}>
                <span style={{fontSize:10,fontWeight:600,color:selDate===i?C.gold:C.muted}}>{d.day}</span>
                <span style={{fontSize:18,fontWeight:700,color:selDate===i?C.gold:C.text}}>{d.date}</span>
                <span style={{fontSize:9,color:selDate===i?C.gold:C.dim}}>{d.month}</span>
              </div>
            ))}
          </div>

          <p className="stit" style={{marginTop:20}}>{dates[selDate].full} — Available Times</p>
          <div className="time-grid">
            {ALL_SLOTS.map(t=>(
              <div key={t} className={`time-chip${selTime===t?" sel":""}${TAKEN_SLOTS.includes(t)?" taken":""}`}
                onClick={()=>!TAKEN_SLOTS.includes(t)&&setSelTime(t)}>
                {t}
              </div>
            ))}
          </div>

          {selTime&&<div style={{marginTop:16,padding:"12px 16px",background:"rgba(76,175,122,.06)",border:"1px solid rgba(76,175,122,.2)",borderRadius:12,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>📅</span>
            <p style={{fontSize:13,fontWeight:500}}><span style={{color:C.green}}>✓</span> {dates[selDate].full} at {selTime} · {selSvc?.dur}</p>
          </div>}
        </div>
      )}

      {/* Step 2: Client info */}
      {step===2&&(
        <div className="screen-enter" style={{padding:"20px 20px",paddingBottom:100}}>
          <div style={{marginBottom:14}}>
            <label className="lbl">Your Name</label>
            <input className="inp" placeholder="First Last" value={clientName} onChange={e=>setClientName(e.target.value)}/>
          </div>
          <div style={{marginBottom:14}}>
            <label className="lbl">Phone Number</label>
            <input className="inp" placeholder="(504) 555-0000" type="tel" value={clientPhone} onChange={e=>setClientPhone(e.target.value)}/>
            <p style={{fontSize:11,color:C.dim,marginTop:4}}>We'll send a reminder 24 hours before your appointment</p>
          </div>
          <div style={{marginBottom:14}}>
            <label className="lbl">Note for your barber (optional)</label>
            <textarea className="txa" placeholder="e.g. Low fade on the sides, keep the top longer..." value={clientNote} onChange={e=>setClientNote(e.target.value)} style={{minHeight:80}}/>
          </div>
          <div style={{marginBottom:14}}>
            <label className="lbl">Promo Code</label>
            <div style={{display:"flex",gap:10}}>
              <input className="inp" style={{flex:1}} placeholder="Enter code" value={promoCode} onChange={e=>setPromoCode(e.target.value)} disabled={promoApplied}/>
              <button onClick={applyPromo} disabled={promoApplied||!promoCode} style={{background:promoApplied?"rgba(76,175,122,.1)":C.card,border:`1px solid ${promoApplied?C.green:C.border}`,color:promoApplied?C.green:C.text,borderRadius:12,padding:"0 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>
                {promoApplied?"Applied ✓":"Apply"}
              </button>
            </div>
            {promoApplied&&<p style={{fontSize:12,color:C.green,marginTop:4}}>🎉 $5 discount applied!</p>}
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step===3&&(
        <div className="screen-enter" style={{padding:"20px 20px",paddingBottom:100}}>
          <div className="booking-confirm">
            <p className="pf" style={{fontSize:18,fontWeight:700,marginBottom:16,color:C.gold}}>Booking Summary</p>
            {[
              {icon:"✂️",label:"Service",val:selSvc?.name},
              {icon:"👤",label:"Barber",val:"Marcus Johnson"},
              {icon:"📅",label:"Date",val:dates[selDate]?.full},
              {icon:"🕐",label:"Time",val:selTime},
              {icon:"⏱",label:"Duration",val:selSvc?.dur},
            ].map(row=>(
              <div key={row.label} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid rgba(201,168,76,.1)"}}>
                <span style={{fontSize:13,color:C.muted}}>{row.icon} {row.label}</span>
                <span style={{fontSize:13,fontWeight:600}}>{row.val}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}>
              <span style={{fontSize:15,fontWeight:700}}>Total</span>
              <div style={{textAlign:"right"}}>
                {promoApplied&&<p style={{fontSize:11,color:C.red,textDecoration:"line-through",marginBottom:1}}>${selSvc?.price}</p>}
                <span className="pf" style={{fontSize:22,fontWeight:700,color:C.gold}}>${finalPrice}</span>
              </div>
            </div>
          </div>

          <div style={{background:C.card,borderRadius:14,padding:14,border:`1px solid ${C.border}`,marginBottom:14}}>
            <p style={{fontSize:13,fontWeight:600,marginBottom:4}}>📍 Location</p>
            <p style={{fontSize:13,color:C.muted}}>Marcus's Barbershop · New Orleans, LA</p>
          </div>

          <div style={{background:"rgba(245,158,11,.05)",border:"1px solid rgba(245,158,11,.2)",borderRadius:12,padding:12,marginBottom:20}}>
            <p style={{fontSize:12,color:C.orange,fontWeight:600}}>⚠️ Cancellation Policy</p>
            <p style={{fontSize:12,color:C.muted,marginTop:4}}>Cancel at least 2 hours before your appointment to avoid a 50% no-show fee.</p>
          </div>
        </div>
      )}

      {/* Sticky CTA */}
      {step<4&&(
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,padding:"16px 20px 32px",background:`linear-gradient(180deg,transparent,${C.bg} 40%)`,zIndex:10}}>
          {selSvc&&step<1&&(
            <div style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 4px"}}>
              <span style={{fontSize:13,color:C.muted}}>{selSvc.name} · {selSvc.dur}</span>
              <span style={{fontSize:16,fontWeight:700,color:C.gold}}>${selSvc.price}</span>
            </div>
          )}
          <button
            className="btn bg"
            disabled={
              (step===0&&!selSvc)||(step===1&&(!selDate&&selDate!==0||!selTime))||(step===2&&(!clientName||!clientPhone))||false
            }
            onClick={()=>{
              if(step===3) setStep(4);
              else setStep(s=>s+1);
            }}
          >
            {step===0?"Choose This Service →":step===1?"Confirm Time →":step===2?"Review Booking →":"Confirm & Book  ✓"}
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// WAITLIST SCREEN
// ══════════════════════════════════════════
function WaitlistScreen({onClose}){
  const [waitlist,setWaitlist]=useState(WAITLIST_INIT);
  const [tab,setTab]=useState("queue");
  const [addOpen,setAddOpen]=useState(false);
  const [notifyOpen,setNotifyOpen]=useState(null); // waitlist entry
  const [detailOpen,setDetailOpen]=useState(null);
  const [toast,setToast]=useState("");
  // Add to waitlist form
  const [wName,setWName]=useState("");
  const [wPhone,setWPhone]=useState("");
  const [wSvc,setWSvc]=useState("Haircut");
  const [wNote,setWNote]=useState("");

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500);};

  const notifyClient=(entry)=>{
    setWaitlist(wl=>wl.map(w=>w.id===entry.id?{...w,notified:true}:w));
    setNotifyOpen(null);
    showToast(`SMS sent to ${entry.name}`);
  };

  const removeFromWaitlist=(id)=>{
    setWaitlist(wl=>wl.filter(w=>w.id!==id).map((w,i)=>({...w,position:i+1})));
    setDetailOpen(null);
    showToast("Removed from waitlist");
  };

  const promoteToBooking=(entry)=>{
    setWaitlist(wl=>wl.filter(w=>w.id!==entry.id).map((w,i)=>({...w,position:i+1})));
    setDetailOpen(null);
    showToast(`${entry.name} moved to appointments!`);
  };

  const addToWaitlist=()=>{
    if(!wName||!wPhone)return;
    const newEntry={id:Date.now(),name:wName,phone:wPhone,service:wSvc,addedAt:"Now",position:waitlist.length+1,notified:false,eta:"~3+ hrs",avatar:wName[0].toUpperCase(),color:C.blue,priority:"normal",note:wNote};
    setWaitlist(wl=>[...wl,newEntry]);
    setWName("");setWPhone("");setWSvc("Haircut");setWNote("");
    setAddOpen(false);
    showToast(`${wName} added to waitlist`);
  };

  const priorityColor={normal:C.muted,vip:C.gold};
  const priorityLabel={normal:"",vip:"⭐ VIP"};

  // Cancel log (simulated)
  const CANCEL_LOG=[
    {time:"9:15 AM",client:"DeShawn W.",service:"Shape-Up",slot:"9:30 AM",notified:"Khalil R.",outcome:"Booked"},
    {time:"Yesterday",client:"No-show",service:"Fade",slot:"11:00 AM",notified:"Leon T.",outcome:"Declined"},
    {time:"Feb 17",client:"Joey T.",service:"Haircut",slot:"2:30 PM",notified:"Samira B.",outcome:"Booked"},
  ];

  return(
    <div className="modfull screen-enter">
      <Toast msg={toast}/>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,#08080F,#0D0D18)`,borderBottom:`1px solid rgba(91,156,246,.2)`,padding:"16px 20px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"6px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>←</button>
            <div>
              <p className="pf" style={{fontSize:18,fontWeight:700,color:C.blue}}>Waitlist</p>
              <p style={{fontSize:11,color:C.muted}}>{waitlist.length} people waiting · Feb 19</p>
            </div>
          </div>
          <button onClick={()=>setAddOpen(true)} style={{background:`rgba(91,156,246,.15)`,border:`1px solid rgba(91,156,246,.3)`,color:C.blue,borderRadius:10,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ Add</button>
        </div>
        <div className="ptabs" style={{background:"rgba(255,255,255,.05)"}}>
          {["queue","log","settings"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",fontSize:11}}>{t}</div>)}
        </div>
      </div>

      <div style={{padding:"16px 20px",paddingBottom:40,overflowY:"auto"}}>

        {/* ── QUEUE TAB ── */}
        {tab==="queue"&&<>
          {/* Summary strip */}
          <div className="stat-pill-row" style={{marginBottom:16}}>
            {[
              {label:"Waiting",val:waitlist.length,color:C.blue},
              {label:"Avg Wait",val:"~1.8 hrs",color:C.muted},
              {label:"Notified Today",val:waitlist.filter(w=>w.notified).length,color:C.green},
              {label:"Converted",val:"3",color:C.gold},
            ].map(s=>(
              <div key={s.label} className="stat-pill">
                <p className="pf" style={{fontSize:18,fontWeight:700,color:s.color}}>{s.val}</p>
                <p style={{fontSize:10,color:C.muted,marginTop:2}}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Auto-notify banner */}
          <div className="notify-banner" style={{marginBottom:16}}>
            <span style={{fontSize:22,flexShrink:0}}>🔔</span>
            <div style={{flex:1}}>
              <p style={{fontSize:13,fontWeight:600,color:C.blue,marginBottom:2}}>Auto-Notify is ON</p>
              <p style={{fontSize:12,color:C.muted}}>When a slot opens, the next client gets an SMS automatically. They have 10 min to confirm.</p>
            </div>
            <div style={{width:36,height:20,background:C.blue,borderRadius:10,position:"relative",cursor:"pointer",flexShrink:0}}>
              <div style={{width:14,height:14,background:"white",borderRadius:"50%",position:"absolute",top:3,right:3}}/>
            </div>
          </div>

          <p className="stit">{waitlist.length} In Queue</p>
          <p className="swipe-hint">Tap a card to manage · drag to reorder</p>

          {waitlist.map((w,i)=>(
            <div key={w.id} className="wl-card" onClick={()=>setDetailOpen(w)} style={{cursor:"pointer"}}>
              <div className={`wl-strip`} style={{background:w.position===1?C.blue:w.priority==="vip"?C.gold:C.border}}/>
              <div style={{display:"flex",gap:12,alignItems:"center",paddingLeft:6}}>
                {/* Rank badge */}
                <div className={`wl-rank${w.position===1?" r1":w.position===2?" r2":" rn"}`}>
                  #{w.position}
                </div>
                {/* Avatar */}
                <div style={{width:40,height:40,borderRadius:"50%",background:`${w.color}22`,border:`1px solid ${w.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:w.color,flexShrink:0,fontFamily:"'Playfair Display',serif"}}>{w.avatar}</div>
                {/* Info */}
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <p style={{fontSize:14,fontWeight:700}}>{w.name}</p>
                    {w.priority==="vip"&&<span style={{fontSize:10,color:C.gold}}>⭐</span>}
                    {w.notified&&<span className="badge bgrn" style={{fontSize:9,padding:"2px 6px"}}>Notified</span>}
                  </div>
                  <p style={{fontSize:12,color:C.muted}}>{w.service} · Added {w.addedAt}</p>
                  {w.note&&<p style={{fontSize:11,color:C.dim,marginTop:2,fontStyle:"italic"}}>"{w.note}"</p>}
                </div>
                {/* ETA + action */}
                <div style={{textAlign:"right",flexShrink:0}}>
                  <p style={{fontSize:12,fontWeight:600,color:w.position===1?C.blue:C.muted}}>{w.eta}</p>
                  {!w.notified?(
                    <button onClick={e=>{e.stopPropagation();setNotifyOpen(w);}} style={{marginTop:4,background:`rgba(91,156,246,.1)`,border:`1px solid rgba(91,156,246,.25)`,color:C.blue,borderRadius:7,padding:"4px 8px",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>📱 Notify</button>
                  ):(
                    <p style={{fontSize:10,color:C.green,marginTop:4}}>✓ SMS sent</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {waitlist.length===0&&(
            <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
              <div style={{fontSize:48,marginBottom:12}}>📋</div>
              <p style={{fontSize:15,fontWeight:600,marginBottom:4}}>Waitlist is empty</p>
              <p style={{fontSize:13}}>Add clients when you're fully booked</p>
            </div>
          )}

          <div onClick={()=>setAddOpen(true)} style={{border:`1px dashed rgba(91,156,246,.3)`,borderRadius:14,padding:14,textAlign:"center",cursor:"pointer",marginTop:8}}>
            <p style={{fontSize:13,color:C.blue}}>+ Add client to waitlist</p>
          </div>
        </>}

        {/* ── LOG TAB ── */}
        {tab==="log"&&<>
          <p className="stit">Cancellation → Waitlist Log</p>
          {CANCEL_LOG.map((l,i)=>(
            <div key={i} className="card" style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700}}>{l.client} cancelled</p>
                  <p style={{fontSize:12,color:C.muted}}>{l.service} · {l.slot} · {l.time}</p>
                </div>
                <span className={`badge ${l.outcome==="Booked"?"bgrn":"bred"}`} style={{fontSize:10}}>{l.outcome}</span>
              </div>
              <div style={{background:C.surface,borderRadius:8,padding:"8px 10px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>📱</span>
                <p style={{fontSize:12,color:C.muted}}>Notified <span style={{color:C.text,fontWeight:600}}>{l.notified}</span> → {l.outcome==="Booked"?"confirmed within 8 min":"didn't respond in 10 min"}</p>
              </div>
            </div>
          ))}
          <div className="card" style={{marginTop:4}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <p style={{fontSize:14,fontWeight:700}}>This Month</p>
            </div>
            {[["Slots opened via cancellation","5"],["Filled from waitlist","3"],["Clients who declined","1"],["Revenue recovered","$145"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{k}</span>
                <span style={{fontSize:13,fontWeight:700,color:C.gold}}>{v}</span>
              </div>
            ))}
          </div>
        </>}

        {/* ── SETTINGS TAB ── */}
        {tab==="settings"&&<>
          <p className="stit">Waitlist Behavior</p>
          <div className="card" style={{marginBottom:16}}>
            {[
              {l:"Auto-Notify Next Client",s:"SMS when slot opens",on:true},
              {l:"Confirm Window",s:"Client has 10 min to reply",on:true},
              {l:"Skip if No Response",s:"Auto-move to next in queue",on:true},
              {l:"VIP Priority",s:"Gold/Platinum skip the queue",on:false},
            ].map((r,i)=>(
              <div key={r.l} className="set-row">
                <div><p style={{fontSize:14,fontWeight:600}}>{r.l}</p><p style={{fontSize:12,color:C.muted}}>{r.s}</p></div>
                <Tog on={r.on} toggle={()=>{}}/>
              </div>
            ))}
          </div>
          <p className="stit">Notification Message</p>
          <div className="card" style={{marginBottom:16}}>
            <p style={{fontSize:12,color:C.muted,marginBottom:8}}>Sent when slot opens up</p>
            <div style={{background:C.surface,borderRadius:10,padding:12,border:`1px solid ${C.border}`,marginBottom:10}}>
              <p style={{fontSize:13,lineHeight:1.5}}>"Hey [name]! A spot just opened up at [time] for your [service]. Reply YES to confirm within 10 min. — Marcus ✂️"</p>
            </div>
            <button className="bgh" style={{width:"100%",textAlign:"center"}}>Edit Template</button>
          </div>
          <p className="stit">Capacity</p>
          <div className="card">
            {[["Max Waitlist Size","20 clients"],["Daily Waitlist Reset","Midnight"],["Notify Cadence","1 at a time"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{k}</span>
                <span style={{fontSize:13,fontWeight:700,color:C.gold}}>{v}</span>
              </div>
            ))}
          </div>
        </>}
      </div>

      {/* Detail drawer */}
      {detailOpen&&<div className="ov" onClick={()=>setDetailOpen(null)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:`${detailOpen.color}22`,border:`1px solid ${detailOpen.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:detailOpen.color,fontFamily:"'Playfair Display',serif"}}>{detailOpen.avatar}</div>
          <div>
            <h3 className="pf" style={{fontSize:20,fontWeight:700}}>{detailOpen.name}</h3>
            <p style={{fontSize:13,color:C.muted}}>#{detailOpen.position} in queue · {detailOpen.service}</p>
          </div>
        </div>
        <div className="card" style={{marginBottom:16}}>
          {[["Phone",detailOpen.phone],["Service",detailOpen.service],["Joined Queue",detailOpen.addedAt],["Est. Wait",detailOpen.eta],["Priority",detailOpen.priority==="vip"?"⭐ VIP":"Normal"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.muted}}>{k}</span>
              <span style={{fontSize:13,fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <button className="btn bg" style={{fontSize:13,padding:"11px"}} onClick={()=>promoteToBooking(detailOpen)}>📅 Book Now</button>
          <button style={{background:`rgba(91,156,246,.1)`,border:`1px solid rgba(91,156,246,.25)`,color:C.blue,borderRadius:12,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}} onClick={()=>{notifyClient(detailOpen);setDetailOpen(null);}}>📱 Notify</button>
        </div>
        <button className="bdgr" style={{width:"100%",padding:"12px",borderRadius:12}} onClick={()=>removeFromWaitlist(detailOpen.id)}>Remove from Waitlist</button>
      </div></div>}

      {/* Notify confirmation modal */}
      {notifyOpen&&<div className="ov" onClick={()=>setNotifyOpen(null)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:4}}>Notify {notifyOpen.name}?</h3>
        <p style={{fontSize:13,color:C.muted,marginBottom:16}}>An SMS will be sent to {notifyOpen.phone}</p>
        <div style={{background:C.surface,borderRadius:12,padding:14,border:`1px solid ${C.border}`,marginBottom:20}}>
          <p style={{fontSize:12,color:C.muted,marginBottom:6}}>Message preview</p>
          <p style={{fontSize:13,lineHeight:1.5,fontStyle:"italic"}}>"{`Hey ${notifyOpen.name.split(" ")[0]}! A spot just opened up for your ${notifyOpen.service}. Reply YES to confirm within 10 min. — Marcus ✂️`}"</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button className="bo" style={{padding:"12px",fontSize:13}} onClick={()=>setNotifyOpen(null)}>Cancel</button>
          <button className="btn bg" style={{padding:"12px",fontSize:13}} onClick={()=>notifyClient(notifyOpen)}>📱 Send SMS</button>
        </div>
      </div></div>}

      {/* Add to waitlist modal */}
      {addOpen&&<div className="ov" onClick={()=>setAddOpen(false)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <h3 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:20}}>Add to Waitlist</h3>
        <div style={{marginBottom:12}}><label className="lbl">Client Name</label><input className="inp" placeholder="First Last" value={wName} onChange={e=>setWName(e.target.value)}/></div>
        <div style={{marginBottom:12}}><label className="lbl">Phone</label><input className="inp" placeholder="(504) 555-0000" type="tel" value={wPhone} onChange={e=>setWPhone(e.target.value)}/></div>
        <div style={{marginBottom:12}}><label className="lbl">Service</label><select className="sel" value={wSvc} onChange={e=>setWSvc(e.target.value)}>{SVCS.map(s=><option key={s.name}>{s.name}</option>)}</select></div>
        <div style={{marginBottom:20}}><label className="lbl">Note (optional)</label><input className="inp" placeholder="Style preferences, notes..." value={wNote} onChange={e=>setWNote(e.target.value)}/></div>
        <button className="btn bg" disabled={!wName||!wPhone} onClick={addToWaitlist}>Add to Waitlist  #{waitlist.length+1}</button>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════
// NO-SHOW MANAGEMENT SCREEN
// ══════════════════════════════════════════
function NoShowScreen({onClose}){
  const [tab,setTab]=useState("at-risk");
  const [noShows,setNoShows]=useState(NOSHOWS_INIT);
  const [atRisk]=useState(AT_RISK_INIT);
  const [feeModal,setFeeModal]=useState(null);   // no-show record
  const [blockModal,setBlockModal]=useState(null);
  const [reminderSent,setReminderSent]=useState({});
  const [toast,setToast]=useState("");
  const [feeSettings,setFeeSettings]=useState({enabled:true,pct:50,autoCharge:false,blockAfter:3,warningEnabled:true,warningHours:2});

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500);};

  const sendReminder=(client)=>{
    setReminderSent(r=>({...r,[client.id]:true}));
    showToast(`Reminder sent to ${client.name}`);
  };

  const chargeNoShowFee=(ns)=>{
    setNoShows(list=>list.map(n=>n.id===ns.id?{...n,feeStatus:"charged"}:n));
    setFeeModal(null);
    showToast(`$${ns.feeAmt} fee charged to ${ns.name}`);
  };
  const waiveFee=(ns)=>{
    setNoShows(list=>list.map(n=>n.id===ns.id?{...n,feeStatus:"waived"}:n));
    setFeeModal(null);
    showToast(`Fee waived for ${ns.name}`);
  };
  const blockClient=(ns)=>{
    setNoShows(list=>list.map(n=>n.id===ns.id?{...n,blocked:true}:n));
    setBlockModal(null);
    showToast(`${ns.name} blocked from booking`);
  };

  const feeStatusColor={charged:C.green,pending:C.orange,waived:C.muted};
  const feeStatusIcon={charged:"✓",pending:"⏳",waived:"—"};

  const pendingFees=noShows.filter(n=>n.feeStatus==="pending");
  const totalRecovered=noShows.filter(n=>n.feeStatus==="charged").reduce((s,n)=>s+n.feeAmt,0);

  return(
    <div className="modfull screen-enter">
      <Toast msg={toast}/>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,#0F0808,#1A0A0A)`,borderBottom:`1px solid rgba(224,82,82,.2)`,padding:"16px 20px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"6px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>←</button>
            <div>
              <p className="pf" style={{fontSize:18,fontWeight:700,color:C.red}}>No-Show Management</p>
              <p style={{fontSize:11,color:C.muted}}>{pendingFees.length} pending fee{pendingFees.length!==1?"s":""} · $${totalRecovered} recovered</p>
            </div>
          </div>
          {pendingFees.length>0&&<div className="alert-pulse" style={{width:10,height:10,borderRadius:"50%",background:C.red,flexShrink:0}}/>}
        </div>
        <div className="ptabs" style={{background:"rgba(255,255,255,.05)"}}>
          {["at-risk","history","settings"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",fontSize:11,position:"relative"}}>
              {t}
              {t==="history"&&pendingFees.length>0&&<div style={{position:"absolute",top:2,right:4,width:7,height:7,background:C.red,borderRadius:"50%"}}/>}
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 20px",paddingBottom:40,overflowY:"auto"}}>

        {/* ── AT-RISK TAB ── */}
        {tab==="at-risk"&&<>
          <p className="stit">Today's Appointments — Upcoming</p>
          {atRisk.map(c=>{
            const urgent=c.minutesUntil<=20;
            const sent=reminderSent[c.id];
            return(
              <div key={c.id} style={{background:urgent?"rgba(224,82,82,.06)":C.card,border:`1px solid ${urgent?"rgba(224,82,82,.3)":C.border}`,borderRadius:16,padding:16,marginBottom:12,transition:"all .2s"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <div className="ns-avatar" style={{width:44,height:44,fontSize:18,background:`${c.color}22`,border:`1px solid ${c.color}44`,color:c.color}}>{c.avatar}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <p style={{fontSize:15,fontWeight:700}}>{c.name}</p>
                      {urgent&&<span className="badge bred" style={{fontSize:9,animation:"alertPulse 2s infinite"}}>⚠ Soon</span>}
                    </div>
                    <p style={{fontSize:12,color:C.muted}}>{c.service} · {c.time}</p>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:22,fontWeight:700,color:urgent?C.red:C.muted,lineHeight:1}}>{c.minutesUntil}</p>
                    <p style={{fontSize:10,color:C.muted}}>min away</p>
                  </div>
                </div>
                {/* Risk bar */}
                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:11,color:C.muted}}>No-show risk</span>
                    <span style={{fontSize:11,fontWeight:600,color:urgent?C.red:C.orange}}>{urgent?"High":"Medium"}</span>
                  </div>
                  <div className="risk-bar"><div className="risk-fill" style={{width:urgent?"75%":"40%",background:urgent?C.red:C.orange}}/></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <button disabled={sent} onClick={()=>sendReminder(c)} style={{background:sent?"rgba(76,175,122,.1)":"rgba(245,158,11,.1)",border:`1px solid ${sent?"rgba(76,175,122,.3)":"rgba(245,158,11,.3)"}`,color:sent?C.green:C.orange,borderRadius:10,padding:"9px",fontSize:12,fontWeight:600,cursor:sent?"default":"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                    {sent?"✓ Reminder Sent":"📱 Send Reminder"}
                  </button>
                  <button onClick={()=>setFeeModal({...c,feeAmt:Math.round(SVCS.find(s=>s.name===c.service.split("+")[0].trim())?.price||30)*0.5,feeStatus:"pending",noShowCount:0})} style={{background:"rgba(224,82,82,.1)",border:"1px solid rgba(224,82,82,.25)",color:C.red,borderRadius:10,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                    🚫 Mark No-Show
                  </button>
                </div>
              </div>
            );
          })}

          {/* Policy reminder */}
          <div style={{background:"rgba(201,168,76,.05)",border:"1px dashed rgba(201,168,76,.2)",borderRadius:12,padding:14,marginTop:8}}>
            <p style={{fontSize:12,fontWeight:600,color:C.gold,marginBottom:4}}>⚡ Auto-warning enabled</p>
            <p style={{fontSize:12,color:C.muted}}>Clients receive an automated SMS 2 hours before their appointment reminding them of your no-show policy.</p>
          </div>
        </>}

        {/* ── HISTORY TAB ── */}
        {tab==="history"&&<>
          {/* Summary stats */}
          <div className="sgrid" style={{marginBottom:16}}>
            <div className="sc"><p style={{fontSize:11,color:C.muted}}>No-Shows (30d)</p><p className="pf" style={{fontSize:22,fontWeight:700,color:C.red}}>{noShows.length}</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>vs 6 prior month</p></div>
            <div className="sc"><p style={{fontSize:11,color:C.muted}}>Fees Recovered</p><p className="pf" style={{fontSize:22,fontWeight:700,color:C.green}}>${totalRecovered}</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>of ${noShows.reduce((s,n)=>s+n.feeAmt,0)} billed</p></div>
            <div className="sc"><p style={{fontSize:11,color:C.muted}}>Pending Fees</p><p className="pf" style={{fontSize:22,fontWeight:700,color:C.orange}}>{pendingFees.length}</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>action needed</p></div>
            <div className="sc"><p style={{fontSize:11,color:C.muted}}>Blocked Clients</p><p className="pf" style={{fontSize:22,fontWeight:700,color:C.red}}>{noShows.filter(n=>n.blocked).length}</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>can't rebook</p></div>
          </div>

          {/* Pending fees first */}
          {pendingFees.length>0&&<>
            <p className="stit" style={{color:C.orange}}>⏳ Pending Action</p>
            {pendingFees.map(ns=>(
              <div key={ns.id} className="danger-card" style={{cursor:"pointer"}} onClick={()=>setFeeModal(ns)}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div className="ns-avatar" style={{width:40,height:40,fontSize:16,background:`${ns.color}22`,border:`1px solid ${ns.color}44`,color:ns.color}}>{ns.avatar}</div>
                  <div style={{flex:1}}>
                    <p style={{fontSize:14,fontWeight:700}}>{ns.name}{ns.blocked&&<span style={{fontSize:10,color:C.red,marginLeft:6}}>🚫 Blocked</span>}</p>
                    <p style={{fontSize:12,color:C.muted}}>{ns.service} · {ns.date}</p>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:16,fontWeight:700,color:C.red}}>${ns.feeAmt}</p>
                    <span className="fee-pill fee-pending">⏳ Pending</span>
                  </div>
                </div>
              </div>
            ))}
          </>}

          <p className="stit" style={{marginTop:4}}>All No-Shows</p>
          {noShows.map(ns=>(
            <div key={ns.id} className="ns-row" style={{cursor:"pointer"}} onClick={()=>setFeeModal(ns)}>
              <div className="ns-avatar" style={{width:42,height:42,fontSize:16,background:`${ns.color}22`,border:`1px solid ${ns.color}44`,color:ns.color}}>{ns.avatar}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                  <p style={{fontSize:14,fontWeight:600}}>{ns.name}</p>
                  {ns.blocked&&<span style={{fontSize:9,color:C.red,background:"rgba(224,82,82,.1)",border:"1px solid rgba(224,82,82,.2)",borderRadius:4,padding:"1px 5px"}}>BLOCKED</span>}
                  {ns.noShowCount>=2&&<span style={{fontSize:9,color:C.orange,background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.2)",borderRadius:4,padding:"1px 5px"}}>{ns.noShowCount}x offender</span>}
                </div>
                <p style={{fontSize:12,color:C.muted}}>{ns.service} · {ns.date} · {ns.time}</p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:3}}>${ns.feeAmt}</p>
                <span className={`fee-pill fee-${ns.feeStatus}`}>{feeStatusIcon[ns.feeStatus]} {ns.feeStatus.charAt(0).toUpperCase()+ns.feeStatus.slice(1)}</span>
              </div>
            </div>
          ))}
        </>}

        {/* ── SETTINGS TAB ── */}
        {tab==="settings"&&<>
          <p className="stit">No-Show Fee Policy</p>
          <div className="card" style={{marginBottom:16}}>
            <div className="set-row">
              <div><p style={{fontSize:14,fontWeight:600}}>Charge No-Show Fees</p><p style={{fontSize:12,color:C.muted}}>Collect a fee when clients don't show</p></div>
              <Tog on={feeSettings.enabled} toggle={()=>setFeeSettings(s=>({...s,enabled:!s.enabled}))}/>
            </div>
            <div className="set-row">
              <div><p style={{fontSize:14,fontWeight:600}}>Auto-Charge</p><p style={{fontSize:12,color:C.muted}}>Charge card on file automatically</p></div>
              <Tog on={feeSettings.autoCharge} toggle={()=>setFeeSettings(s=>({...s,autoCharge:!s.autoCharge}))}/>
            </div>
            <div style={{padding:"14px 0",borderBottom:`1px solid ${C.border}`}}>
              <p style={{fontSize:14,fontWeight:600,marginBottom:10}}>Fee Amount</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {[25,50,75,100].map(pct=>(
                  <div key={pct} onClick={()=>setFeeSettings(s=>({...s,pct}))} style={{background:feeSettings.pct===pct?"rgba(201,168,76,.1)":C.surface,border:`1px solid ${feeSettings.pct===pct?C.gold:C.border}`,borderRadius:10,padding:"10px 0",textAlign:"center",cursor:"pointer",transition:"all .2s"}}>
                    <p style={{fontSize:14,fontWeight:700,color:feeSettings.pct===pct?C.gold:C.text}}>{pct}%</p>
                  </div>
                ))}
              </div>
              <p style={{fontSize:11,color:C.muted,marginTop:8}}>e.g. {feeSettings.pct}% of a $40 fade = ${(40*feeSettings.pct/100).toFixed(0)} fee</p>
            </div>
          </div>

          <p className="stit">Client Protection</p>
          <div className="card" style={{marginBottom:16}}>
            <div style={{padding:"14px 0",borderBottom:`1px solid ${C.border}`}}>
              <p style={{fontSize:14,fontWeight:600,marginBottom:8}}>Auto-Block After</p>
              <div style={{display:"flex",gap:10}}>
                {[2,3,4,5].map(n=>(
                  <div key={n} onClick={()=>setFeeSettings(s=>({...s,blockAfter:n}))} style={{background:feeSettings.blockAfter===n?"rgba(224,82,82,.1)":C.surface,border:`1px solid ${feeSettings.blockAfter===n?"rgba(224,82,82,.4)":C.border}`,borderRadius:10,flex:1,padding:"10px 0",textAlign:"center",cursor:"pointer",transition:"all .2s"}}>
                    <p style={{fontSize:15,fontWeight:700,color:feeSettings.blockAfter===n?C.red:C.text}}>{n}x</p>
                  </div>
                ))}
              </div>
              <p style={{fontSize:11,color:C.muted,marginTop:8}}>Client gets blocked after {feeSettings.blockAfter} no-shows</p>
            </div>
            <div className="set-row">
              <div><p style={{fontSize:14,fontWeight:600}}>Pre-Appointment Warning</p><p style={{fontSize:12,color:C.muted}}>SMS reminder with policy {feeSettings.warningHours}hrs before</p></div>
              <Tog on={feeSettings.warningEnabled} toggle={()=>setFeeSettings(s=>({...s,warningEnabled:!s.warningEnabled}))}/>
            </div>
          </div>

          <p className="stit">Warning SMS Template</p>
          <div className="card" style={{marginBottom:20}}>
            <div style={{background:C.surface,borderRadius:10,padding:12,border:`1px solid ${C.border}`,marginBottom:10}}>
              <p style={{fontSize:13,lineHeight:1.5,fontStyle:"italic"}}>"Hey [name], just a reminder: your [service] with Marcus is at [time] today. No-shows are charged {feeSettings.pct}% of the service price. See you soon! ✂️"</p>
            </div>
            <button className="bgh" style={{width:"100%",textAlign:"center"}}>Edit Template</button>
          </div>
        </>}
      </div>

      {/* Fee action modal */}
      {feeModal&&<div className="ov" onClick={()=>setFeeModal(null)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <h3 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:4}}>{feeModal.name}</h3>
        <p style={{fontSize:13,color:C.muted,marginBottom:16}}>{feeModal.service} · {feeModal.date||"Today"}</p>
        {/* Fee amount */}
        <div style={{background:"rgba(224,82,82,.06)",border:"1px solid rgba(224,82,82,.2)",borderRadius:14,padding:16,textAlign:"center",marginBottom:16}}>
          <p style={{fontSize:12,color:C.muted,marginBottom:4}}>No-Show Fee ({feeSettings.pct}%)</p>
          <p className="pf" style={{fontSize:36,fontWeight:700,color:C.red}}>${feeModal.feeAmt}</p>
          <p style={{fontSize:11,color:C.dim}}>of ${(feeModal.feeAmt/(feeSettings.pct/100)).toFixed(0)} service</p>
        </div>
        {feeModal.feeStatus==="pending"&&<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <button style={{background:"rgba(224,82,82,.1)",border:"1px solid rgba(224,82,82,.3)",color:C.red,borderRadius:12,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}} onClick={()=>chargeNoShowFee(feeModal)}>💳 Charge Fee</button>
            <button className="bo" style={{fontSize:14,padding:"12px"}} onClick={()=>waiveFee(feeModal)}>Waive Fee</button>
          </div>
          {feeModal.noShowCount>=2&&!feeModal.blocked&&(
            <button onClick={()=>{setFeeModal(null);setBlockModal(feeModal);}} style={{width:"100%",padding:"12px",borderRadius:12,background:"transparent",border:"1px solid rgba(224,82,82,.3)",color:C.red,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600}}>🚫 Block Client ({feeModal.noShowCount}x no-show)</button>
          )}
        </>}
        {feeModal.feeStatus!=="pending"&&(
          <div style={{textAlign:"center",padding:"10px 0"}}>
            <p style={{fontSize:15,fontWeight:600,color:feeModal.feeStatus==="charged"?C.green:C.muted}}>{feeModal.feeStatus==="charged"?"✓ Fee Charged":"— Fee Waived"}</p>
          </div>
        )}
        {feeModal.blocked&&<div style={{background:"rgba(224,82,82,.06)",border:"1px solid rgba(224,82,82,.2)",borderRadius:10,padding:12,marginTop:12,textAlign:"center"}}><p style={{fontSize:13,color:C.red,fontWeight:600}}>🚫 This client is blocked from booking</p></div>}
      </div></div>}

      {/* Block confirmation modal */}
      {blockModal&&<div className="ov" onClick={()=>setBlockModal(null)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <div style={{textAlign:"center",padding:"10px 0 20px"}}>
          <div style={{fontSize:48,marginBottom:12}}>🚫</div>
          <h3 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:4}}>Block {blockModal.name}?</h3>
          <p style={{fontSize:13,color:C.muted,marginBottom:20}}>They'll be unable to book appointments. You can unblock them anytime from their client profile.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button className="bo" style={{padding:"12px",fontSize:13}} onClick={()=>setBlockModal(null)}>Cancel</button>
            <button style={{background:"rgba(224,82,82,.15)",border:"1px solid rgba(224,82,82,.3)",color:C.red,borderRadius:12,padding:"12px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}} onClick={()=>blockClient(blockModal)}>Block Client</button>
          </div>
        </div>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════
// ══════════════════════════════════════════
// NOTIFICATIONS CENTER
// ══════════════════════════════════════════
function NotificationsCenter({onClose}){
  const [notifs,setNotifs]=useState(NOTIFS_INIT);
  const [filter,setFilter]=useState("all");
  const [tab,setTab]=useState("inbox");

  const typeColor={appt:C.gold,pay:C.green,alert:C.red,mktg:C.purple};
  const typeLabel={appt:"Appointment",pay:"Payment",alert:"Alert",mktg:"Marketing"};

  const filtered=notifs.filter(n=>filter==="all"||n.type===filter);
  const unread=notifs.filter(n=>!n.read).length;

  const markAllRead=()=>setNotifs(ns=>ns.map(n=>({...n,read:true})));
  const markRead=(id)=>setNotifs(ns=>ns.map(n=>n.id===id?{...n,read:true}:n));

  const PUSH_SETTINGS=[
    {key:"appt",label:"Appointment Alerts",sub:"New bookings, cancellations, reminders",on:true,icon:"📅"},
    {key:"pay",label:"Payment Notifications",sub:"Charges, tips, payouts",on:true,icon:"💰"},
    {key:"nosh",label:"No-Show Alerts",sub:"When clients miss appointments",on:true,icon:"🚨"},
    {key:"review",label:"New Reviews",sub:"Star ratings from clients",on:true,icon:"⭐"},
    {key:"mktg",label:"Marketing Updates",sub:"SMS blast results, promo stats",on:false,icon:"📣"},
    {key:"wl",label:"Waitlist Activity",sub:"New joins, slot fills",on:true,icon:"📋"},
    {key:"payout",label:"Payout Processed",sub:"Stripe payouts to your bank",on:true,icon:"💳"},
    {key:"digest",label:"Daily Digest",sub:"End-of-day summary at 8 PM",on:true,icon:"📊"},
  ];
  const [pushSettings,setPushSettings]=useState(()=>Object.fromEntries(PUSH_SETTINGS.map(s=>[s.key,s.on])));

  return(
    <div className="modfull screen-enter">
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,#080810,#0D0D1A)`,borderBottom:`1px solid rgba(167,139,250,.2)`,padding:"16px 20px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"6px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>←</button>
            <div>
              <p className="pf" style={{fontSize:18,fontWeight:700,color:C.purple}}>Notifications</p>
              <p style={{fontSize:11,color:C.muted}}>{unread} unread</p>
            </div>
          </div>
          {unread>0&&<button onClick={markAllRead} style={{background:"transparent",border:"none",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Mark all read</button>}
        </div>
        <div className="ptabs" style={{background:"rgba(255,255,255,.05)"}}>
          {["inbox","settings"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",fontSize:11}}>{t}{t==="inbox"&&unread>0&&<span style={{marginLeft:5,background:C.red,borderRadius:"50%",width:14,height:14,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white"}}>{unread}</span>}</div>)}
        </div>
      </div>

      <div style={{padding:"16px 20px",paddingBottom:40}}>

        {tab==="inbox"&&<>
          {/* Filter chips */}
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:16,scrollbarWidth:"none"}}>
            {[["all","All"],["appt","Appts"],["pay","Payments"],["alert","Alerts"],["mktg","Marketing"]].map(([k,l])=>(
              <Chip key={k} label={l} active={filter===k} onClick={()=>setFilter(k)}/>
            ))}
          </div>

          {/* Live push preview cards */}
          {unread>0&&<>
            <p className="stit">Incoming</p>
            {notifs.filter(n=>!n.read).map(n=>(
              <div key={n.id} className={`push-preview ${n.type}`} onClick={()=>markRead(n.id)} style={{cursor:"pointer"}}>
                <div className="notif-icon-wrap" style={{background:`${typeColor[n.type]}18`,fontSize:20}}>{n.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                    <p style={{fontSize:13,fontWeight:700}}>{n.title}</p>
                    <span style={{fontSize:10,color:C.dim,whiteSpace:"nowrap",marginLeft:8}}>{n.time}</span>
                  </div>
                  <p style={{fontSize:12,color:C.muted}}>{n.body}</p>
                  <span style={{fontSize:10,color:typeColor[n.type],fontWeight:600,marginTop:4,display:"block"}}>{typeLabel[n.type]}</span>
                </div>
                {!n.read&&<div className="notif-dot"/>}
              </div>
            ))}
          </>}

          <p className="stit" style={{marginTop:8}}>Earlier</p>
          {filtered.filter(n=>n.read).map(n=>(
            <div key={n.id} className="notif-item" onClick={()=>{}}>
              <div className="notif-icon-wrap" style={{background:`${typeColor[n.type]}12`,fontSize:18,opacity:.7}}>{n.icon}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2}}>
                  <p style={{fontSize:13,fontWeight:600,color:C.muted}}>{n.title}</p>
                  <span style={{fontSize:10,color:C.dim,whiteSpace:"nowrap",marginLeft:8}}>{n.time}</span>
                </div>
                <p style={{fontSize:12,color:C.dim}}>{n.body}</p>
              </div>
            </div>
          ))}
          {filtered.filter(n=>n.read).length===0&&<div style={{textAlign:"center",padding:"30px 0",color:C.dim}}><p>No older notifications</p></div>}
        </>}

        {tab==="settings"&&<>
          <div className="notify-banner" style={{marginBottom:20}}>
            <span style={{fontSize:22}}>📱</span>
            <div>
              <p style={{fontSize:13,fontWeight:600,color:C.blue}}>Push Notifications</p>
              <p style={{fontSize:12,color:C.muted}}>Enabled on this device. Manage what you receive below.</p>
            </div>
          </div>
          <p className="stit">Notification Types</p>
          <div className="card" style={{marginBottom:16}}>
            {PUSH_SETTINGS.map((s,i)=>(
              <div key={s.key} className="set-row">
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:18}}>{s.icon}</span>
                  <div><p style={{fontSize:14,fontWeight:600}}>{s.label}</p><p style={{fontSize:11,color:C.muted}}>{s.sub}</p></div>
                </div>
                <Tog on={pushSettings[s.key]} toggle={()=>setPushSettings(ps=>({...ps,[s.key]:!ps[s.key]}))}/>
              </div>
            ))}
          </div>
          <p className="stit">Quiet Hours</p>
          <div className="card" style={{marginBottom:16}}>
            {[["Start","10:00 PM"],["End","7:00 AM"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{l}</span>
                <span style={{fontSize:13,fontWeight:600,color:C.gold}}>{v}</span>
              </div>
            ))}
            <div className="set-row"><div><p style={{fontSize:14,fontWeight:600}}>Quiet Hours</p><p style={{fontSize:11,color:C.muted}}>Pause non-urgent alerts overnight</p></div><Tog on={true} toggle={()=>{}}/></div>
          </div>
          <p className="stit">Daily Digest</p>
          <div className="card">
            <p style={{fontSize:13,color:C.muted,marginBottom:12}}>Get a summary of your day every evening</p>
            {[["Revenue","Included"],["Appointments","Included"],["New Clients","Included"],["No-Shows","Included"],["Send Time","8:00 PM"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{k}</span>
                <span style={{fontSize:13,fontWeight:600,color:C.green}}>{v}</span>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// CLIENT APP VIEW (client-facing logged-in)
// ══════════════════════════════════════════
function ClientAppView({onClose}){
  const [tab,setTab]=useState("home");
  const CLIENT={name:"Marcus J.",tier:"Gold",points:480,avatar:"M",nextAppt:{service:"Fade + Beard",date:"Mar 1",time:"10:00 AM",barber:"Marcus J."},history:[
    {service:"Fade + Beard",date:"Feb 15",price:54,rating:5},
    {service:"Fade",date:"Feb 1",price:40,rating:5},
    {service:"Shape-Up",date:"Jan 4",price:25,rating:4},
  ]};
  const tierColor={Bronze:"#CD7F32",Silver:"#9E9E9E",Gold:C.gold,Platinum:"#C8D8FF"};
  const nextTier={name:"Platinum",min:1000};
  const pct=Math.round(((CLIENT.points-500)/(1000-500))*100);

  return(
    <div className="modfull screen-enter">
      {/* Client mode header */}
      <div style={{background:`linear-gradient(135deg,#0A0800,#150F00)`,borderBottom:`1px solid rgba(201,168,76,.2)`,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,fontFamily:"'Playfair Display',serif",color:"#0D0D0D"}}>M</div>
          <div><p style={{fontSize:13,fontWeight:700,color:C.gold}}>Client View</p><p style={{fontSize:10,color:C.muted}}>Previewing as Marcus J.</p></div>
        </div>
        <button onClick={onClose} className="switch-mode-btn">⚡ Barber Mode</button>
      </div>

      {/* Client nav */}
      <div className="ptabs" style={{margin:"0",padding:"8px 16px",borderBottom:`1px solid ${C.border}`,borderRadius:0,gap:4}}>
        {["home","book","loyalty","history"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",fontSize:12}}>{t}</div>)}
      </div>

      <div style={{overflowY:"auto",paddingBottom:40}}>

        {tab==="home"&&<>
          {/* Hero */}
          <div className="client-hero">
            <p style={{fontSize:11,color:"rgba(201,168,76,.6)",fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Welcome back</p>
            <h1 className="pf" style={{fontSize:28,fontWeight:700,lineHeight:1.15,marginBottom:4}}>{CLIENT.name}</h1>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
              <span style={{fontSize:12,fontWeight:700,color:tierColor[CLIENT.tier],background:`${tierColor[CLIENT.tier]}18`,border:`1px solid ${tierColor[CLIENT.tier]}33`,borderRadius:20,padding:"2px 10px"}}>⭐ {CLIENT.tier} Member</span>
              <span style={{fontSize:12,color:C.muted}}>{CLIENT.points} pts</span>
            </div>
          </div>

          {/* Next appointment */}
          <div style={{padding:"0 20px",marginTop:-10}}>
            <div className="client-appt-card">
              <div style={{position:"absolute",top:0,right:0,bottom:0,left:0,background:"url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23C9A84C' fill-opacity='0.04'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")",borderRadius:18}}/>
              <p style={{fontSize:11,color:"rgba(201,168,76,.6)",fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:8,position:"relative"}}>Next Appointment</p>
              <p className="pf" style={{fontSize:22,fontWeight:700,marginBottom:2,position:"relative"}}>{CLIENT.nextAppt.service}</p>
              <p style={{fontSize:13,color:C.muted,marginBottom:12,position:"relative"}}>with {CLIENT.nextAppt.barber}</p>
              <div style={{display:"flex",gap:16,position:"relative"}}>
                <div><p style={{fontSize:11,color:"rgba(201,168,76,.5)"}}>Date</p><p style={{fontSize:14,fontWeight:700,color:C.gold}}>{CLIENT.nextAppt.date}</p></div>
                <div><p style={{fontSize:11,color:"rgba(201,168,76,.5)"}}>Time</p><p style={{fontSize:14,fontWeight:700,color:C.gold}}>{CLIENT.nextAppt.time}</p></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14,position:"relative"}}>
                <button style={{background:"rgba(201,168,76,.15)",border:"1px solid rgba(201,168,76,.3)",borderRadius:10,padding:"9px",fontSize:12,fontWeight:600,color:C.gold,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>📅 Reschedule</button>
                <button style={{background:"rgba(224,82,82,.1)",border:"1px solid rgba(224,82,82,.25)",borderRadius:10,padding:"9px",fontSize:12,fontWeight:600,color:C.red,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✕ Cancel</button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="client-action-grid">
              {[{icon:"✂️",label:"Book Again"},{icon:"🎁",label:"Gift Card"},{icon:"⭐",label:"Leave Review"},{icon:"📋",label:"Waitlist"},{icon:"📱",label:"Contact"},{icon:"💰",label:"Pay Now"}].map(a=>(
                <div key={a.label} className="client-action">
                  <div style={{fontSize:22,marginBottom:6}}>{a.icon}</div>
                  <p style={{fontSize:11,color:C.muted,fontWeight:500}}>{a.label}</p>
                </div>
              ))}
            </div>

            {/* Recent cut */}
            <p className="stit">Your last visit</p>
            <div className="card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div><p style={{fontSize:15,fontWeight:700}}>{CLIENT.history[0].service}</p><p style={{fontSize:13,color:C.muted}}>{CLIENT.history[0].date}</p></div>
                <div style={{textAlign:"right"}}><p style={{fontSize:18,fontWeight:700,color:C.gold}}>${CLIENT.history[0].price}</p><Stars n={CLIENT.history[0].rating}/></div>
              </div>
            </div>
          </div>
        </>}

        {tab==="book"&&<div style={{padding:"20px"}}>
          <h2 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:4}}>Book a Service</h2>
          <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Chop-It-Up · Marcus Johnson</p>
          <p className="stit">Select Service</p>
          {SVCS.map(s=>(
            <div key={s.name} className="svc-card" style={{marginBottom:10,cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{fontSize:22}}>{s.icon}</span>
                  <div><p style={{fontSize:14,fontWeight:700}}>{s.name}</p><p style={{fontSize:12,color:C.muted}}>{s.dur}</p></div>
                </div>
                <p style={{fontSize:16,fontWeight:700,color:C.gold}}>${s.price}</p>
              </div>
            </div>
          ))}
          <button className="btn bg" style={{marginTop:8}}>Continue →</button>
        </div>}

        {tab==="loyalty"&&<div style={{padding:"20px"}}>
          {/* Loyalty ring */}
          <div className="loyalty-ring-wrap">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke={C.border} strokeWidth="8"/>
              <circle cx="55" cy="55" r="46" fill="none" stroke={C.gold} strokeWidth="8"
                strokeDasharray={`${2*Math.PI*46*pct/100} ${2*Math.PI*46*(1-pct/100)}`}
                strokeLinecap="round" transform="rotate(-90 55 55)"/>
              <text x="55" y="50" textAnchor="middle" fill={C.gold} fontSize="18" fontWeight="700" fontFamily="Playfair Display">{CLIENT.points}</text>
              <text x="55" y="66" textAnchor="middle" fill={C.muted} fontSize="10" fontFamily="DM Sans">points</text>
            </svg>
            <p className="pf" style={{fontSize:18,fontWeight:700,color:tierColor[CLIENT.tier]}}>{CLIENT.tier} Member</p>
            <p style={{fontSize:12,color:C.muted}}>{nextTier.min-CLIENT.points} pts to {nextTier.name}</p>
            <div className="pb" style={{width:"100%",marginTop:6}}><div className="pbf" style={{width:`${pct}%`}}/></div>
          </div>
          <p className="stit">Your Perks</p>
          <div className="card" style={{marginBottom:16}}>
            {["15% off every 5th visit","Skip the waitlist","Free service on birthday","Early access to promos"].map(p=>(
              <div key={p} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.green}}>✓</span><p style={{fontSize:13}}>{p}</p>
              </div>
            ))}
          </div>
          <p className="stit">Points History</p>
          {[["Fade + Beard · Feb 15","+540","Today"],["Fade · Feb 1","+400","Feb 1"],["Referral Bonus","+100","Jan 20"]].map(([l,pts,d])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
              <div><p style={{fontSize:13,fontWeight:600}}>{l}</p><p style={{fontSize:11,color:C.dim}}>{d}</p></div>
              <p style={{fontSize:14,fontWeight:700,color:C.green}}>{pts} pts</p>
            </div>
          ))}
        </div>}

        {tab==="history"&&<div style={{padding:"20px"}}>
          <h2 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:4}}>Visit History</h2>
          <p style={{fontSize:13,color:C.muted,marginBottom:20}}>{CLIENT.history.length} visits · ${CLIENT.history.reduce((s,h)=>s+h.price,0)} total spent</p>
          {CLIENT.history.map((h,i)=>(
            <div key={i} className="card" style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div><p style={{fontSize:14,fontWeight:700}}>{h.service}</p><p style={{fontSize:12,color:C.muted}}>{h.date}</p></div>
                <p style={{fontSize:18,fontWeight:700,color:C.gold}}>${h.price}</p>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <Stars n={h.rating}/>
                <button style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,color:C.gold,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Book Again</button>
              </div>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// INVENTORY MANAGEMENT
// ══════════════════════════════════════════
function InventoryScreen({onClose}){
  const [inventory,setInventory]=useState(INVENTORY_INIT);
  const [tab,setTab]=useState("stock");
  const [selItem,setSelItem]=useState(null);
  const [addOpen,setAddOpen]=useState(false);
  const [saleOpen,setSaleOpen]=useState(false);
  const [saleItems,setSaleItems]=useState([]);
  const [toast,setToast]=useState("");
  const [newItem,setNewItem]=useState({name:"",category:"Products",price:"",cost:"",qty:"",maxQty:"",reorderAt:"",icon:"🛍️"});

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500);};

  const stockPct=(item)=>Math.round((item.qty/item.maxQty)*100);
  const stockColor=(item)=>item.qty===0?C.red:item.qty<=item.reorderAt?C.orange:C.green;
  const stockLabel=(item)=>item.qty===0?"Out of Stock":item.qty<=item.reorderAt?"Low Stock":"In Stock";

  const adjustQty=(id,delta)=>{
    setInventory(inv=>inv.map(i=>i.id===id?{...i,qty:Math.max(0,Math.min(i.maxQty,i.qty+delta))}:i));
  };

  const addSaleItem=(item)=>{
    setSaleItems(si=>{
      const ex=si.find(s=>s.id===item.id);
      if(ex) return si.map(s=>s.id===item.id?{...s,qty:s.qty+1}:s);
      return [...si,{...item,qty:1}];
    });
  };

  const completeSale=()=>{
    saleItems.forEach(si=>{
      setInventory(inv=>inv.map(i=>i.id===si.id?{...i,qty:Math.max(0,i.qty-si.qty),sold30d:i.sold30d+si.qty}:i));
    });
    setSaleItems([]);
    setSaleOpen(false);
    showToast(`Sale of $${saleItems.reduce((s,i)=>s+i.price*i.qty,0).toFixed(2)} recorded!`);
  };

  const lowStockItems=inventory.filter(i=>i.qty<=i.reorderAt);
  const totalValue=inventory.reduce((s,i)=>s+i.qty*i.cost,0);
  const productRevenue=inventory.filter(i=>i.category==="Products").reduce((s,i)=>s+i.sold30d*i.price,0);

  return(
    <div className="modfull screen-enter">
      <Toast msg={toast}/>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,#08100A,#0D1A10)`,borderBottom:`1px solid rgba(76,175,122,.2)`,padding:"16px 20px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"6px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>←</button>
            <div>
              <p className="pf" style={{fontSize:18,fontWeight:700,color:C.green}}>Inventory</p>
              <p style={{fontSize:11,color:C.muted}}>{inventory.length} items · ${totalValue.toFixed(0)} stock value</p>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setSaleOpen(true)} style={{background:`rgba(76,175,122,.15)`,border:`1px solid rgba(76,175,122,.3)`,color:C.green,borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ Sale</button>
            <button onClick={()=>setAddOpen(true)} style={{background:`rgba(76,175,122,.1)`,border:`1px solid rgba(76,175,122,.2)`,color:C.green,borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ Item</button>
          </div>
        </div>
        <div className="ptabs" style={{background:"rgba(255,255,255,.05)"}}>
          {["stock","sales","reorder"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",fontSize:11,position:"relative"}}>
              {t}
              {t==="reorder"&&lowStockItems.length>0&&<div style={{position:"absolute",top:2,right:4,width:6,height:6,background:C.red,borderRadius:"50%"}}/>}
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 20px",paddingBottom:40}}>

        {tab==="stock"&&<>
          {/* Stats */}
          <div className="stat-pill-row" style={{marginBottom:16}}>
            {[{l:"Total Items",v:inventory.length},{l:"Stock Value",v:`$${totalValue.toFixed(0)}`},{l:"Low/Out",v:lowStockItems.length},{l:"Product Rev (30d)",v:`$${productRevenue}`}].map(s=>(
              <div key={s.l} className="stat-pill">
                <p className="pf" style={{fontSize:18,fontWeight:700,color:s.l==="Low/Out"&&lowStockItems.length>0?C.orange:C.gold}}>{s.v}</p>
                <p style={{fontSize:10,color:C.muted,marginTop:2}}>{s.l}</p>
              </div>
            ))}
          </div>

          {inventory.map(item=>(
            <div key={item.id} className={`inv-card${item.qty===0?" out-stock":item.qty<=item.reorderAt?" low-stock":""}`} onClick={()=>setSelItem(item)}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:44,height:44,borderRadius:12,background:`${stockColor(item)}15`,border:`1px solid ${stockColor(item)}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{item.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2}}>
                    <p style={{fontSize:14,fontWeight:700}}>{item.name}</p>
                    <span style={{fontSize:10,fontWeight:700,color:stockColor(item),background:`${stockColor(item)}15`,border:`1px solid ${stockColor(item)}30`,borderRadius:6,padding:"2px 7px"}}>{stockLabel(item)}</span>
                  </div>
                  <p style={{fontSize:12,color:C.muted,marginBottom:6}}>{item.category}{item.price>0&&` · Sells for $${item.price}`}</p>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <button className="qty-btn" onClick={e=>{e.stopPropagation();adjustQty(item.id,-1);}}>−</button>
                      <p style={{fontSize:16,fontWeight:700,minWidth:24,textAlign:"center"}}>{item.qty}</p>
                      <button className="qty-btn" onClick={e=>{e.stopPropagation();adjustQty(item.id,1);}}>+</button>
                      <p style={{fontSize:11,color:C.dim}}>{item.unit}s</p>
                    </div>
                    <p style={{fontSize:12,color:C.muted}}>Max: {item.maxQty}</p>
                  </div>
                  <div className="stock-bar" style={{marginTop:8}}>
                    <div className="stock-fill" style={{width:`${stockPct(item)}%`,background:stockColor(item)}}/>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>}

        {tab==="sales"&&<>
          <div className="sgrid" style={{marginBottom:16}}>
            {[["Product Revenue","$"+productRevenue,"30 days"],["Units Sold","41","this month"],["Best Seller","Pomade","14 units"],["Avg Sale","$16.50","per transaction"]].map(([l,v,s])=>(
              <div key={l} className="sc"><p style={{fontSize:11,color:C.muted}}>{l}</p><p className="pf" style={{fontSize:18,fontWeight:700,color:C.green,marginTop:4}}>{v}</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>{s}</p></div>
            ))}
          </div>
          <p className="stit">Products — 30d Sales</p>
          {inventory.filter(i=>i.category==="Products").sort((a,b)=>b.sold30d-a.sold30d).map(item=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:22}}>{item.icon}</span>
              <div style={{flex:1}}>
                <p style={{fontSize:14,fontWeight:600}}>{item.name}</p>
                <div className="pb" style={{marginTop:4}}><div style={{height:"100%",background:C.green,borderRadius:2,width:`${Math.round(item.sold30d/14*100)}%`}}/></div>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:14,fontWeight:700,color:C.green}}>{item.sold30d} sold</p>
                <p style={{fontSize:11,color:C.muted}}>${(item.sold30d*item.price).toFixed(0)} rev</p>
              </div>
            </div>
          ))}
        </>}

        {tab==="reorder"&&<>
          {lowStockItems.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <p style={{fontSize:15,fontWeight:600}}>All stocked up!</p>
              <p style={{fontSize:13,color:C.muted}}>No items need reordering right now</p>
            </div>
          ):<>
            <div className="notify-banner" style={{borderColor:"rgba(224,82,82,.25)",background:"rgba(224,82,82,.06)"}}>
              <span style={{fontSize:22}}>⚠️</span>
              <div><p style={{fontSize:13,fontWeight:600,color:C.red}}>{lowStockItems.length} items need attention</p><p style={{fontSize:12,color:C.muted}}>Below reorder threshold or out of stock</p></div>
            </div>
            {lowStockItems.map(item=>(
              <div key={item.id} className={`inv-card${item.qty===0?" out-stock":" low-stock"}`}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{fontSize:26}}>{item.icon}</span>
                  <div style={{flex:1}}>
                    <p style={{fontSize:14,fontWeight:700}}>{item.name}</p>
                    <p style={{fontSize:12,color:C.muted}}>{item.qty===0?"OUT OF STOCK":`Only ${item.qty} left · reorder at ${item.reorderAt}`}</p>
                  </div>
                  <button style={{background:`rgba(76,175,122,.1)`,border:`1px solid rgba(76,175,122,.25)`,color:C.green,borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>🛒 Order</button>
                </div>
              </div>
            ))}
            <div className="card" style={{marginTop:8}}>
              <p style={{fontSize:13,fontWeight:600,marginBottom:4}}>💡 Pro tip</p>
              <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Set up automatic reorder reminders to never run out during busy days. Connect with your supplier in Settings.</p>
            </div>
          </>}
        </>}
      </div>

      {/* Item detail modal */}
      {selItem&&<div className="ov" onClick={()=>setSelItem(null)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:20}}>
          <div style={{width:52,height:52,borderRadius:14,background:`${stockColor(selItem)}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{selItem.icon}</div>
          <div><h3 className="pf" style={{fontSize:20,fontWeight:700}}>{selItem.name}</h3><p style={{fontSize:12,color:C.muted}}>{selItem.category} · {selItem.sku}</p></div>
        </div>
        <div className="card" style={{marginBottom:16}}>
          {[["Current Stock",`${selItem.qty} ${selItem.unit}s`],["Max Capacity",selItem.maxQty],["Reorder At",`${selItem.reorderAt} ${selItem.unit}s`],["Cost",selItem.cost>0?`$${selItem.cost}`:"-"],["Sell Price",selItem.price>0?`$${selItem.price}`:"-"],["Sold (30d)",selItem.sold30d]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.muted}}>{k}</span><span style={{fontSize:13,fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {selItem.price>0&&<button className="btn bg" style={{fontSize:13,padding:"11px"}} onClick={()=>{addSaleItem(selItem);setSelItem(null);setSaleOpen(true);}}>💰 Add to Sale</button>}
          <button className="bo" style={{fontSize:13,padding:"11px"}} onClick={()=>setSelItem(null)}>Done</button>
        </div>
      </div></div>}

      {/* Sale modal */}
      {saleOpen&&<div className="ov" onClick={()=>setSaleOpen(false)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <h3 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:4}}>Record a Sale</h3>
        <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Select products sold to this client</p>
        {inventory.filter(i=>i.category==="Products"&&i.qty>0).map(item=>(
          <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:20}}>{item.icon}</span>
            <div style={{flex:1}}><p style={{fontSize:13,fontWeight:600}}>{item.name}</p><p style={{fontSize:12,color:C.gold}}>${item.price}</p></div>
            <button onClick={()=>addSaleItem(item)} style={{background:`rgba(76,175,122,.1)`,border:`1px solid rgba(76,175,122,.25)`,color:C.green,borderRadius:8,padding:"5px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ Add</button>
          </div>
        ))}
        {saleItems.length>0&&<>
          <div style={{background:C.surface,borderRadius:12,padding:12,marginTop:16,marginBottom:16}}>
            <p style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:8}}>SALE TOTAL</p>
            {saleItems.map(si=>(
              <div key={si.id} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:13}}>{si.icon} {si.name} ×{si.qty}</span>
                <span style={{fontSize:13,fontWeight:600,color:C.gold}}>${(si.price*si.qty).toFixed(2)}</span>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${C.border}`,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:15,fontWeight:700}}>Total</span>
              <span className="pf" style={{fontSize:18,fontWeight:700,color:C.gold}}>${saleItems.reduce((s,i)=>s+i.price*i.qty,0).toFixed(2)}</span>
            </div>
          </div>
          <button className="btn bg" onClick={completeSale}>💰 Complete Sale</button>
        </>}
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════
// SOCIAL MEDIA AUTO-POSTING
// ══════════════════════════════════════════
function SocialScreen({onClose}){
  const [tab,setTab]=useState("compose");
  const [posts,setPosts]=useState(SOCIAL_POSTS_INIT);
  const [selPlatforms,setSelPlatforms]=useState(["Instagram"]);
  const [caption,setCaption]=useState("");
  const [generating,setGenerating]=useState(false);
  const [schedOpen,setSchedOpen]=useState(false);
  const [toast,setToast]=useState("");

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500);};

  const PLATFORMS=[
    {id:"Instagram",icon:"📸",color:"#E1306C"},
    {id:"Facebook",icon:"👍",color:"#1877F2"},
    {id:"TikTok",icon:"🎵",color:"#ff0050"},
  ];

  const AI_TEMPLATES=[
    {label:"Open Slots 🗓",prompt:"Announce open appointment slots, friendly & inviting"},
    {label:"Fresh Cut 💈",prompt:"Post-appointment transformation hype post"},
    {label:"Flash Deal ⚡",prompt:"Limited-time discount offer, urgency-driven"},
    {label:"Loyalty 🏆",prompt:"Reward loyal clients, appreciation post"},
    {label:"Before/After 🔄",prompt:"Transformation reveal, encouraging engagement"},
    {label:"Client Shoutout ⭐",prompt:"Thank a 5-star reviewer anonymously"},
  ];

  const CAPTIONS_BY_TYPE={
    "Open Slots 🗓":"🗓 Got some slots opening up this week! Monday & Wednesday afternoons are wide open — don't wait, they go fast. Book at the link in bio or DM me directly. ✂️\n\n#BarberLife #NewOrleans #ChopItUp #FreshCut #BarberShop",
    "Fresh Cut 💈":"💈 Another one done RIGHT 🔥 This client came in wanting a clean fade and walked out looking like a whole different man. This is why I do what I do.\n\nBook your transformation at chopitup.app/marcus ✂️\n\n#Fade #BarberShop #NOLA #Transformation",
    "Flash Deal ⚡":"⚡ FLASH DEAL — this weekend only! $5 off any service when you mention this post. First 10 clients only, so don't sleep on it 😤\n\nBook NOW: chopitup.app/marcus\n\n#FlashSale #BarberDeal #ChopItUp",
  };

  const generateCaption=(template)=>{
    setGenerating(true);
    setCaption("");
    setTimeout(()=>{
      setCaption(CAPTIONS_BY_TYPE[template]||`✂️ ${template.split(" ")[0]} Fresh fades and clean cuts — that's what we do at Chop-It-Up. Book your slot at chopitup.app/marcus 💈\n\n#BarberLife #NOLA #ChopItUp #FreshCut`);
      setGenerating(false);
    },1200);
  };

  const schedulePost=()=>{
    const newPost={id:Date.now(),platform:selPlatforms,content:caption,media:"custom",scheduled:"Tomorrow 10:00 AM",status:"scheduled",likes:0,reach:0};
    setPosts(p=>[newPost,...p]);
    setCaption("");
    setSchedOpen(false);
    showToast("Post scheduled!");
  };

  const postNow=()=>{
    showToast(`Posted to ${selPlatforms.join(" & ")}!`);
    setCaption("");
  };

  return(
    <div className="modfull screen-enter">
      <Toast msg={toast}/>
      <div style={{background:`linear-gradient(135deg,#0F0818,#180A20)`,borderBottom:`1px solid rgba(167,139,250,.2)`,padding:"16px 20px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"6px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>←</button>
            <div>
              <p className="pf" style={{fontSize:18,fontWeight:700,color:C.purple}}>Social Posting</p>
              <p style={{fontSize:11,color:C.muted}}>AI-powered content · auto-schedule</p>
            </div>
          </div>
          <span className="badge bpur" style={{fontSize:10}}>AI</span>
        </div>
        <div className="ptabs" style={{background:"rgba(255,255,255,.05)"}}>
          {["compose","scheduled","analytics"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",fontSize:11}}>{t}</div>)}
        </div>
      </div>

      <div style={{padding:"16px 20px",paddingBottom:40}}>

        {tab==="compose"&&<>
          {/* Platform selector */}
          <p className="stit">Post To</p>
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            {PLATFORMS.map(p=>(
              <div key={p.id} className={`platform-chip${selPlatforms.includes(p.id)?" sel":""}`}
                onClick={()=>setSelPlatforms(sp=>sp.includes(p.id)?sp.filter(x=>x!==p.id):[...sp,p.id])}>
                <span>{p.icon}</span><span>{p.id}</span>
              </div>
            ))}
          </div>

          {/* AI Generator */}
          <p className="stit">AI Caption Generator</p>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:12,scrollbarWidth:"none"}}>
            {AI_TEMPLATES.map(t=>(
              <span key={t.label} className="mtag" style={{flexShrink:0}} onClick={()=>generateCaption(t.label)}>{t.label}</span>
            ))}
          </div>

          <div className="ai-gen-btn" onClick={()=>generateCaption("Fresh Cut 💈")}>
            <span style={{fontSize:20}}>✨</span>
            <div style={{flex:1,textAlign:"left"}}><p style={{fontSize:13,fontWeight:600,color:C.purple}}>Generate AI Caption</p><p style={{fontSize:11,color:C.muted}}>Tap a template above or let AI surprise you</p></div>
            {generating&&<div style={{width:16,height:16,border:`2px solid ${C.purple}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>}
          </div>

          {/* Caption editor */}
          <p className="stit">Caption</p>
          {generating?(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14,minHeight:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:28,marginBottom:8}}>✨</div><p style={{fontSize:13,color:C.purple}}>Generating caption...</p></div>
            </div>
          ):(
            <textarea className="txa" placeholder="Write your caption here, or tap a template above to generate one with AI..." value={caption} onChange={e=>setCaption(e.target.value)} style={{minHeight:140}}/>
          )}
          {caption&&<p style={{fontSize:11,color:C.muted,marginTop:4,marginBottom:16}}>{caption.length} characters · {selPlatforms.join(", ")}</p>}

          {/* Action buttons */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8}}>
            <button className="bo" style={{padding:"12px",fontSize:13}} disabled={!caption} onClick={()=>setSchedOpen(true)}>📅 Schedule</button>
            <button className="btn bg" style={{padding:"12px",fontSize:13}} disabled={!caption||selPlatforms.length===0} onClick={postNow}>🚀 Post Now</button>
          </div>

          {/* Hashtag suggestions */}
          {caption&&<div style={{marginTop:16}}>
            <p className="stit">Suggested Hashtags</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["#BarberShop","#NOLA","#ChopItUp","#FreshCut","#Fade","#BarberLife","#NewOrleans","#Barbershop504"].map(h=>(
                <span key={h} onClick={()=>setCaption(c=>c+"\n"+h)} style={{fontSize:12,color:C.blue,background:"rgba(91,156,246,.08)",border:"1px solid rgba(91,156,246,.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>{h}</span>
              ))}
            </div>
          </div>}
        </>}

        {tab==="scheduled"&&<>
          <p className="stit">{posts.filter(p=>p.status==="scheduled").length} Scheduled · {posts.filter(p=>p.status==="published").length} Published</p>
          {posts.map(post=>(
            <div key={post.id} className="post-card">
              <div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:post.status==="published"?C.green:C.purple,borderRadius:"16px 0 0 16px"}}/>
              <div style={{paddingLeft:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{display:"flex",gap:6}}>
                    {post.platform.map(p=><span key={p} style={{fontSize:11,fontWeight:600,color:C.muted,background:C.surface,borderRadius:6,padding:"2px 8px",border:`1px solid ${C.border}`}}>{PLATFORMS.find(x=>x.id===p)?.icon} {p}</span>)}
                  </div>
                  <span className={`badge ${post.status==="published"?"bgrn":"bpur"}`} style={{fontSize:10}}>{post.status==="published"?"✓ Published":"⏱ Scheduled"}</span>
                </div>
                <p style={{fontSize:13,color:C.text,lineHeight:1.5,marginBottom:10}}>{post.content.slice(0,100)}...</p>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <p style={{fontSize:11,color:C.muted}}>📅 {post.scheduled}</p>
                  {post.status==="published"&&<div style={{display:"flex",gap:12}}>
                    <span style={{fontSize:12,color:C.pink}}>❤️ {post.likes}</span>
                    <span style={{fontSize:12,color:C.blue}}>👁 {post.reach}</span>
                  </div>}
                </div>
              </div>
            </div>
          ))}
        </>}

        {tab==="analytics"&&<>
          <div className="sgrid" style={{marginBottom:16}}>
            {[["Total Reach","501","across all posts"],["Total Likes","70","this month"],["Posts Published","3","this month"],["Bookings via Social","7","tracked"]].map(([l,v,s])=>(
              <div key={l} className="sc"><p style={{fontSize:11,color:C.muted}}>{l}</p><p className="pf" style={{fontSize:20,fontWeight:700,color:C.purple,marginTop:4}}>{v}</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>{s}</p></div>
            ))}
          </div>
          <div className="card" style={{marginBottom:16}}>
            <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>Best Performing</p>
            {[["Instagram Transformation","❤️ 47 likes · 👁 312 reach",C.pink],["Facebook Flash Deal","❤️ 23 likes · 👁 189 reach",C.blue]].map(([t,s,c])=>(
              <div key={t} style={{padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <p style={{fontSize:13,fontWeight:600}}>{t}</p>
                <p style={{fontSize:12,color:c,marginTop:2}}>{s}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>💡 AI Insights</p>
            {["Your posts with transformation photos get 3× more reach than text-only.","Best time to post: Tuesday & Thursday 6-8 PM based on your audience.","You haven't posted in 5 days — engagement tends to drop after 4 days."].map((tip,i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:i<2?`1px solid ${C.border}`:"none"}}>
                <span style={{fontSize:14,flexShrink:0}}>✨</span>
                <p style={{fontSize:12,color:C.text,lineHeight:1.5}}>{tip}</p>
              </div>
            ))}
          </div>
        </>}
      </div>

      {/* Schedule modal */}
      {schedOpen&&<div className="ov" onClick={()=>setSchedOpen(false)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <h3 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:4}}>Schedule Post</h3>
        <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Pick a date & time to auto-publish</p>
        <div style={{marginBottom:12}}><label className="lbl">Date</label><input className="inp" type="date"/></div>
        <div style={{marginBottom:20}}><label className="lbl">Time</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {["9:00 AM","12:00 PM","3:00 PM","6:00 PM","7:00 PM","8:00 PM"].map(t=>(
              <div key={t} className="tslot" style={{fontSize:12}}>{t}</div>
            ))}
          </div>
        </div>
        <button className="btn bg" onClick={schedulePost}>📅 Schedule</button>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════
// MULTI-BARBER SHOP MANAGEMENT
// ══════════════════════════════════════════
function MultiBarberScreen({onClose}){
  const [tab,setTab]=useState("floor");
  const [barbers,setBarbers]=useState(SHOP_BARBERS);
  const [selBarber,setSelBarber]=useState(null);
  const [inviteOpen,setInviteOpen]=useState(false);
  const [toast,setToast]=useState("");

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500);};

  const statusColor={active:C.green,busy:C.gold,offline:C.border};
  const statusLabel={active:"Available",busy:"With Client",offline:"Offline"};

  const totalRev=barbers.reduce((s,b)=>s+b.revenue,0);
  const totalAppts=barbers.reduce((s,b)=>s+b.appts,0);

  // Schedule grid times
  const SCHED_HOURS=["9AM","10AM","11AM","12PM","1PM"];

  return(
    <div className="modfull screen-enter">
      <Toast msg={toast}/>
      <div style={{background:`linear-gradient(135deg,#0A080F,#140F18)`,borderBottom:`1px solid rgba(167,139,250,.2)`,padding:"16px 20px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"6px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>←</button>
            <div>
              <p className="pf" style={{fontSize:18,fontWeight:700,color:C.purple}}>Shop Management</p>
              <p style={{fontSize:11,color:C.muted}}>{barbers.filter(b=>b.status!=="offline").length}/{barbers.length} barbers active today</p>
            </div>
          </div>
          <button onClick={()=>setInviteOpen(true)} style={{background:`rgba(167,139,250,.15)`,border:`1px solid rgba(167,139,250,.3)`,color:C.purple,borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ Invite</button>
        </div>
        <div className="ptabs" style={{background:"rgba(255,255,255,.05)"}}>
          {["floor","schedule","revenue","settings"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",fontSize:11}}>{t}</div>)}
        </div>
      </div>

      <div style={{padding:"16px 20px",paddingBottom:40}}>

        {/* ── FLOOR VIEW ── */}
        {tab==="floor"&&<>
          {/* Live stats */}
          <div className="stat-pill-row" style={{marginBottom:16}}>
            {[{l:"Active",v:barbers.filter(b=>b.status==="busy").length,c:C.gold},{l:"Available",v:barbers.filter(b=>b.status==="active").length,c:C.green},{l:"Offline",v:barbers.filter(b=>b.status==="offline").length,c:C.muted},{l:"Appts Today",v:totalAppts,c:C.blue}].map(s=>(
              <div key={s.l} className="stat-pill">
                <p className="pf" style={{fontSize:20,fontWeight:700,color:s.c}}>{s.v}</p>
                <p style={{fontSize:10,color:C.muted,marginTop:2}}>{s.l}</p>
              </div>
            ))}
          </div>

          {barbers.map(barber=>(
            <div key={barber.id} className={`barber-chair${barber.status==="active"?" active":barber.status==="busy"?" busy":barber.status==="offline"?" offline":""}`} onClick={()=>setSelBarber(barber)} style={{cursor:"pointer"}}>
              <div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:statusColor[barber.status],borderRadius:"16px 0 0 16px"}}/>
              <div style={{paddingLeft:8}}>
                {/* Barber header */}
                <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
                  <div style={{position:"relative"}}>
                    <div style={{width:48,height:48,borderRadius:"50%",background:`linear-gradient(135deg,${barber.color},${barber.color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,fontFamily:"'Playfair Display',serif",color:"#0D0D0D"}}>{barber.avatar}</div>
                    <div className="chair-status" style={{position:"absolute",bottom:0,right:0,background:statusColor[barber.status]}} />
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                      <p style={{fontSize:15,fontWeight:700}}>{barber.name}</p>
                      <span className="badge bgold" style={{fontSize:9}}>{barber.role}</span>
                    </div>
                    <p style={{fontSize:12,color:C.muted}}>Chair #{barber.chair} · ⭐ {barber.rating}</p>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:11,fontWeight:700,color:statusColor[barber.status],background:`${statusColor[barber.status]}15`,border:`1px solid ${statusColor[barber.status]}30`,borderRadius:6,padding:"2px 8px"}}>{statusLabel[barber.status]}</span>
                    {barber.nextAppt&&<p style={{fontSize:11,color:C.muted,marginTop:4}}>Next: {barber.nextAppt}</p>}
                  </div>
                </div>

                {/* Current client */}
                {barber.currentClient&&(
                  <div style={{background:"rgba(201,168,76,.08)",border:"1px solid rgba(201,168,76,.2)",borderRadius:10,padding:"8px 12px",marginBottom:10}}>
                    <p style={{fontSize:12,color:C.muted}}>Currently serving</p>
                    <p style={{fontSize:14,fontWeight:600,color:C.gold}}>{barber.currentClient}</p>
                  </div>
                )}

                {/* Stats row */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:0,background:C.surface,borderRadius:10,overflow:"hidden"}}>
                  {[["Revenue",`$${barber.revenue.toLocaleString()}`],["Appts",barber.appts],["Rating",`${barber.rating}★`]].map(([l,v],i)=>(
                    <div key={l} style={{padding:"10px 0",textAlign:"center",borderRight:i<2?`1px solid ${C.border}`:"none"}}>
                      <p style={{fontSize:14,fontWeight:700,color:barber.color}}>{v}</p>
                      <p style={{fontSize:10,color:C.muted}}>{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </>}

        {/* ── SCHEDULE VIEW ── */}
        {tab==="schedule"&&<>
          <p className="stit">Today's Schedule — Feb 19</p>
          <div className="schedule-grid">
            {/* Header */}
            <div className="sch-cell hdr"></div>
            {barbers.map(b=>(
              <div key={b.id} className="sch-cell hdr">
                <div style={{width:24,height:24,borderRadius:"50%",background:`${b.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:b.color,margin:"0 auto 2px"}}>{b.avatar}</div>
                <p style={{fontSize:9,color:C.muted}}>{b.name.split(" ")[0]}</p>
              </div>
            ))}
            {/* Time slots */}
            {SCHED_HOURS.map((hour,hi)=>[
              <div key={`t${hi}`} className="sch-cell hdr" style={{fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>{hour}</div>,
              ...barbers.map(b=>{
                const svc=b.schedule[hi];
                return(
                  <div key={`${b.id}-${hi}`} className={`sch-cell${svc?" booked":" free"}`}>
                    {svc?<p style={{fontSize:9,fontWeight:600,lineHeight:1.2}}>{svc}</p>:<p style={{fontSize:9,color:C.green}}>Free</p>}
                  </div>
                );
              })
            ])}
          </div>
          <div className="card" style={{marginBottom:16}}>
            <p style={{fontSize:13,fontWeight:600,marginBottom:10}}>Capacity Today</p>
            {barbers.map(b=>{
              const booked=b.schedule.filter(s=>s).length;
              const total=b.schedule.length;
              return(
                <div key={b.id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13}}>{b.name}</span>
                    <span style={{fontSize:12,fontWeight:600,color:b.color}}>{booked}/{total} slots</span>
                  </div>
                  <div className="pb"><div style={{height:"100%",background:b.color,borderRadius:2,width:`${Math.round(booked/total*100)}%`}}/></div>
                </div>
              );
            })}
          </div>
        </>}

        {/* ── REVENUE TAB ── */}
        {tab==="revenue"&&<>
          <div className="sgrid" style={{marginBottom:16}}>
            {[["Total Revenue",`$${totalRev.toLocaleString()}`,C.gold],["Total Appts",totalAppts,C.blue],["Avg per Appt",`$${Math.round(totalRev/totalAppts)}`,C.green],["Barbers",barbers.length,C.purple]].map(([l,v,c])=>(
              <div key={l} className="sc"><p style={{fontSize:11,color:C.muted}}>{l}</p><p className="pf" style={{fontSize:20,fontWeight:700,color:c,marginTop:4}}>{v}</p></div>
            ))}
          </div>

          {/* Revenue split visual */}
          <div className="card" style={{marginBottom:16}}>
            <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>Revenue Split</p>
            <div className="rev-split">
              {barbers.map(b=><div key={b.id} style={{flex:b.revenue,background:b.color,height:"100%"}}/>)}
            </div>
            <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap"}}>
              {barbers.map(b=>(
                <div key={b.id} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:10,height:10,borderRadius:2,background:b.color}}/>
                  <span style={{fontSize:11,color:C.muted}}>{b.name.split(" ")[0]}: ${b.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-barber breakdown */}
          {barbers.map(b=>(
            <div key={b.id} className="card" style={{marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${b.color},${b.color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,fontFamily:"'Playfair Display',serif",color:"#0D0D0D"}}>{b.avatar}</div>
                <div style={{flex:1}}><p style={{fontSize:14,fontWeight:600}}>{b.name}</p><p style={{fontSize:11,color:C.muted}}>{b.role} · Chair #{b.chair}</p></div>
                <p className="pf" style={{fontSize:18,fontWeight:700,color:b.color}}>${b.revenue.toLocaleString()}</p>
              </div>
              {[["Appointments",b.appts],["Avg Ticket",`$${Math.round(b.revenue/b.appts)}`],["Rating",`${b.rating}★`],["Platform Fee (3%)",`-$${Math.round(b.revenue*.03)}`],["Net Payout",`$${Math.round(b.revenue*.97).toLocaleString()}`]].map(([k,v],i)=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<4?`1px solid ${C.border}`:"none"}}>
                  <span style={{fontSize:12,color:C.muted}}>{k}</span>
                  <span style={{fontSize:12,fontWeight:i===4?700:600,color:i===4?C.green:C.text}}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </>}

        {/* ── SETTINGS TAB ── */}
        {tab==="settings"&&<>
          <p className="stit">Shop Settings</p>
          <div className="card" style={{marginBottom:16}}>
            {[["Shop Name","Chop-It-Up"],["Location","New Orleans, LA"],["Phone","(504) 555-0100"],["Platform Fee","3% per booking"],["Payout Schedule","Weekly (Fridays)"],["Chairs / Stations","3"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{k}</span>
                <span style={{fontSize:13,fontWeight:600,color:C.gold}}>{v}</span>
              </div>
            ))}
          </div>
          <p className="stit">Permissions</p>
          <div className="card" style={{marginBottom:16}}>
            {[
              {l:"Barbers can see each other's schedules",on:true},
              {l:"Barbers can add to waitlist",on:true},
              {l:"Barbers can apply promos",on:false},
              {l:"Barbers can view shop analytics",on:false},
            ].map(r=>(
              <div key={r.l} className="set-row"><p style={{fontSize:13,flex:1,paddingRight:12}}>{r.l}</p><Tog on={r.on} toggle={()=>{}}/></div>
            ))}
          </div>
          <button className="btn bg">+ Add a Chair</button>
        </>}
      </div>

      {/* Barber detail modal */}
      {selBarber&&<div className="ov" onClick={()=>setSelBarber(null)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${selBarber.color},${selBarber.color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,fontFamily:"'Playfair Display',serif",color:"#0D0D0D"}}>{selBarber.avatar}</div>
          <div><h3 className="pf" style={{fontSize:20,fontWeight:700}}>{selBarber.name}</h3><p style={{fontSize:12,color:C.muted}}>{selBarber.role} · Chair #{selBarber.chair}</p></div>
        </div>
        <div className="card" style={{marginBottom:16}}>
          {[["Status",statusLabel[selBarber.status]],["Phone",selBarber.phone],["Revenue","$"+selBarber.revenue.toLocaleString()],["Appointments",selBarber.appts],["Rating",selBarber.rating+"★"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.muted}}>{k}</span><span style={{fontSize:13,fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <button style={{background:`rgba(91,156,246,.1)`,border:`1px solid rgba(91,156,246,.25)`,color:C.blue,borderRadius:12,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}} onClick={()=>{showToast(`Message sent to ${selBarber.name}`);setSelBarber(null);}}>📱 Message</button>
          <button className="btn bg" style={{fontSize:13,padding:"11px"}} onClick={()=>setSelBarber(null)}>View Schedule</button>
        </div>
        {selBarber.role!=="Owner"&&<button className="bdgr" style={{width:"100%",padding:"12px",borderRadius:12}} onClick={()=>{showToast(`${selBarber.name} removed from shop`);setBarbers(b=>b.filter(x=>x.id!==selBarber.id));setSelBarber(null);}}>Remove from Shop</button>}
      </div></div>}

      {/* Invite modal */}
      {inviteOpen&&<div className="ov" onClick={()=>setInviteOpen(false)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <h3 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:4}}>Invite a Barber</h3>
        <p style={{fontSize:13,color:C.muted,marginBottom:20}}>They'll get a link to join your shop on Chop-It-Up</p>
        <div style={{marginBottom:12}}><label className="lbl">Name</label><input className="inp" placeholder="Barber's full name"/></div>
        <div style={{marginBottom:12}}><label className="lbl">Phone or Email</label><input className="inp" placeholder="(504) 555-0000 or email"/></div>
        <div style={{marginBottom:20}}><label className="lbl">Chair Number</label><select className="sel"><option>Chair 4</option><option>Chair 5</option></select></div>
        <div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.2)",borderRadius:10,padding:12,marginBottom:16}}>
          <p style={{fontSize:12,color:C.muted}}>💡 They'll pay $10/month and you earn a <span style={{color:C.gold,fontWeight:600}}>$10 referral credit</span> when they join.</p>
        </div>
        <button className="btn bg" onClick={()=>{setInviteOpen(false);showToast("Invite sent!");}}>📤 Send Invite</button>
      </div></div>}
    </div>
  );
}

// CLIENTS SCREEN (v4 preserved)
// ══════════════════════════════════════════
function ClientsScreen(){
  const [search,setSearch]=useState("");
  const [sel,setSel]=useState(null);
  const [histTab,setHistTab]=useState("history");
  const [noteText,setNoteText]=useState("");
  const [loading,setLoading]=useState(true);
  const [clients,setClients]=useState(CLIENTS);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const c=await ParseService.getClients();
        if(!cancelled) setClients(c.length?c:CLIENTS);
      } catch(e){
        if(!cancelled) setClients(CLIENTS);
      } finally {
        if(!cancelled) setLoading(false);
      }
    })();
    return()=>{cancelled=true;};
  },[]);

  const filtered=clients.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.phone.includes(search));
  const tier=sel?LOYALTY_TIERS.find(t=>sel.points>=t.min&&sel.points<=t.max):null;
  const nextTier=sel?LOYALTY_TIERS.find(t=>t.min>sel.points):null;
  const pct=sel&&nextTier?Math.round(((sel.points-tier.min)/(nextTier.min-tier.min))*100):100;

  if(sel) return(
    <div className="screen screen-enter">
      <div style={{padding:"20px 20px 0",display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={()=>setSel(null)} style={{background:"none",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"7px 14px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>← Clients</button>
        <span style={{fontSize:13,color:C.muted}}>Client Profile</span>
      </div>
      <div style={{padding:"0 20px"}}>
        <div className="card" style={{padding:20,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
            <div className="pav" style={{width:60,height:60,fontSize:24,background:`linear-gradient(135deg,${sel.gradient[0]},${sel.gradient[1]})`}}>{sel.avatar}</div>
            <div style={{flex:1}}>
              <h2 className="pf" style={{fontSize:22,fontWeight:700}}>{sel.name}</h2>
              <p style={{fontSize:13,color:C.muted}}>{sel.phone}</p>
              <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                <TierBadge tier={sel.tier}/>
                {sel.recurring&&<span className="badge bpur" style={{fontSize:10}}>🔄 {sel.recurring}</span>}
                {sel.noShows>0&&<span className="badge bred" style={{fontSize:10}}>⚠ {sel.noShows} no-show</span>}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:0,textAlign:"center"}}>
            {[["💇",sel.visits,"Visits"],["💰","$"+sel.spent,"Spent"],["⭐",sel.points,"Points"]].map(([ic,v,l],i,arr)=>(
              <div key={l} style={{padding:"10px 0",borderRight:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
                <p style={{fontSize:11,marginBottom:2}}>{ic}</p>
                <p className="pf" style={{fontSize:18,fontWeight:700,color:C.gold}}>{v}</p>
                <p style={{fontSize:10,color:C.muted}}>{l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <p style={{fontSize:13,fontWeight:600}}>Loyalty — <span style={{color:C.gold}}>{sel.tier}</span></p>
            {nextTier&&<p style={{fontSize:12,color:C.muted}}>{nextTier.min-sel.points} pts to {nextTier.name}</p>}
          </div>
          <div className="pb" style={{marginBottom:8}}><div className="pbf" style={{width:`${pct}%`}}/></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{tier?.perks.map(p=><span key={p} style={{fontSize:11,color:C.green,background:"rgba(76,175,122,.08)",border:"1px solid rgba(76,175,122,.2)",borderRadius:6,padding:"2px 8px"}}>✓ {p}</span>)}</div>
        </div>
        <div className="card" style={{marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><p style={{fontSize:11,color:C.muted,marginBottom:2}}>Favorite Service</p><p style={{fontSize:15,fontWeight:700}}>{sel.preferredSvc}</p></div>
          <div style={{textAlign:"right"}}><p style={{fontSize:11,color:C.muted,marginBottom:2}}>Last Visit</p><p style={{fontSize:15,fontWeight:700}}>{sel.lastVisit}</p></div>
          <div style={{textAlign:"right"}}><p style={{fontSize:11,color:C.muted,marginBottom:2}}>Next Visit</p><p style={{fontSize:15,fontWeight:700,color:sel.nextVisit?C.green:C.dim}}>{sel.nextVisit||"Not booked"}</p></div>
        </div>
        <div className="ptabs" style={{marginBottom:16}}>
          {["history","notes","actions"].map(t=><div key={t} className={`ptab${histTab===t?" act":""}`} onClick={()=>setHistTab(t)} style={{textTransform:"capitalize"}}>{t}</div>)}
        </div>
        {histTab==="history"&&<>
          <p className="stit">{sel.history.length} visits on record</p>
          {sel.history.map((h,i)=>(
            <div key={i} className="card" style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:h.note?8:0}}>
                <div><p style={{fontSize:14,fontWeight:600}}>{h.service}</p><p style={{fontSize:12,color:C.muted}}>{h.date}</p></div>
                <div style={{textAlign:"right"}}><p style={{fontSize:14,fontWeight:700,color:C.gold}}>${h.price}</p>{h.tip>0&&<p style={{fontSize:11,color:C.green}}>+${h.tip} tip</p>}</div>
              </div>
              {h.note&&<p style={{fontSize:12,color:C.muted,background:C.surface,borderRadius:8,padding:"7px 10px",fontStyle:"italic"}}>📝 "{h.note}"</p>}
            </div>
          ))}
        </>}
        {histTab==="notes"&&<>
          <p className="stit">Barber Notes</p>
          <div style={{marginBottom:12}}><textarea className="txa" placeholder="Add a note about this client's preferences..." value={noteText} onChange={e=>setNoteText(e.target.value)} style={{minHeight:100}}/></div>
          <button className="btn bg" disabled={!noteText} onClick={()=>setNoteText("")}>Save Note</button>
          {sel.history.filter(h=>h.note).length>0&&<>
            <p className="stit" style={{marginTop:20}}>Past Notes</p>
            {sel.history.filter(h=>h.note).map((h,i)=>(
              <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:12,marginBottom:8}}>
                <p style={{fontSize:12,color:C.muted,marginBottom:4}}>{h.date} · {h.service}</p>
                <p style={{fontSize:13,fontStyle:"italic",color:C.text}}>"{h.note}"</p>
              </div>
            ))}
          </>}
        </>}
        {histTab==="actions"&&<div style={{marginBottom:20}}>
          <p className="stit">Client Actions</p>
          {[
            {icon:"📅",label:"Book Appointment",sub:"Schedule next visit",color:C.gold},
            {icon:"📱",label:"Send SMS",sub:"Quick message to client",color:C.blue},
            {icon:"🎁",label:"Send Gift Card",sub:"Send a gift card balance",color:C.pink},
            {icon:"⭐",label:"Award Bonus Points",sub:"Manually add loyalty points",color:C.purple},
            {icon:"🚫",label:"Block Client",sub:"Prevent future bookings",color:C.red},
          ].map(a=>(
            <div key={a.label} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
              <div style={{width:40,height:40,borderRadius:12,background:`${a.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{a.icon}</div>
              <div style={{flex:1}}><p style={{fontSize:14,fontWeight:600}}>{a.label}</p><p style={{fontSize:12,color:C.muted}}>{a.sub}</p></div>
              <span style={{color:C.dim,fontSize:16}}>›</span>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );

  return(
    <div className="screen screen-enter">
      <div className="hdr" style={{paddingBottom:16}}>
        <h2 className="pf" style={{fontSize:24,fontWeight:700,marginBottom:16}}>Clients</h2>
        <input className="inp" placeholder="🔍  Search by name or phone..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:12}}/>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
          {["All","Gold","Silver","Bronze","Recurring"].map(f=><Chip key={f} label={f} active={f==="All"} onClick={()=>{}}/>)}
        </div>
      </div>
      <div className="sec" style={{marginBottom:20}}>
        <p className="stit">{filtered.length} clients · $3,685 lifetime value</p>
        {loading?(
          <>{[1,2,3].map(i=><SkeletonCard key={i}/>)}</>
        ):(
          filtered.map(c=>(
            <div key={c.id} className="client-row" onClick={()=>setSel(c)}>
              <div className="pav" style={{width:44,height:44,fontSize:18,flexShrink:0,background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`}}>{c.avatar}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <p style={{fontSize:14,fontWeight:700}}>{c.name}</p>
                  <TierBadge tier={c.tier}/>
                </div>
                <p style={{fontSize:12,color:C.muted}}>{c.preferredSvc} · {c.visits} visits · Last: {c.lastVisit}</p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{fontSize:13,fontWeight:700,color:C.gold}}>${c.spent}</p>
                <p style={{fontSize:11,color:C.muted}}>{c.points} pts</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// LOYALTY REWARDS (v4 preserved)
// ══════════════════════════════════════════
function LoyaltyScreen(){
  const [tab,setTab]=useState("overview");
  const totalActive=CLIENTS.length;
  const tierCounts=LOYALTY_TIERS.map(t=>({...t,count:CLIENTS.filter(c=>c.points>=t.min&&c.points<=t.max).length}));
  return(
    <div className="screen screen-enter">
      <div className="hdr" style={{paddingBottom:16}}>
        <h2 className="pf" style={{fontSize:24,fontWeight:700,marginBottom:4}}>Loyalty Rewards</h2>
        <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Keep clients coming back</p>
        <div className="ptabs">{["overview","tiers","activity"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>)}</div>
      </div>
      {tab==="overview"&&<div className="sec">
        <div className="sgrid" style={{marginBottom:16}}>
          <div className="sc"><p style={{fontSize:11,color:C.muted}}>Active Members</p><p className="pf" style={{fontSize:24,fontWeight:700,color:C.gold}}>{totalActive}</p><p style={{fontSize:11,color:C.green,marginTop:4}}>↑ 3 this month</p></div>
          <div className="sc"><p style={{fontSize:11,color:C.muted}}>Points Issued</p><p className="pf" style={{fontSize:24,fontWeight:700}}>1,450</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>this month</p></div>
          <div className="sc"><p style={{fontSize:11,color:C.muted}}>Rewards Redeemed</p><p className="pf" style={{fontSize:24,fontWeight:700,color:C.purple}}>4</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>$68 in discounts</p></div>
          <div className="sc"><p style={{fontSize:11,color:C.muted}}>Retention Rate</p><p className="pf" style={{fontSize:24,fontWeight:700,color:C.green}}>84%</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>vs 71% avg</p></div>
        </div>
        <p className="stit">Member Distribution</p>
        {tierCounts.map(t=>(
          <div key={t.name} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{width:52,textAlign:"right"}}><span style={{fontSize:12,fontWeight:700,color:t.color}}>{t.name}</span></div>
            <div style={{flex:1,height:8,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",background:t.color,borderRadius:4,width:`${totalActive>0?(t.count/totalActive)*100:0}%`,transition:"width .5s ease"}}/></div>
            <span style={{fontSize:13,fontWeight:600,color:C.muted,width:16}}>{t.count}</span>
          </div>
        ))}
        <div className="card" style={{marginTop:16}}>
          <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>Points Rules</p>
          {[["Per dollar spent","10 pts"],["Per referral","100 pts"],["Birthday bonus","50 pts"],["5-star review left","25 pts"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.muted}}>{k}</span><span style={{fontSize:13,fontWeight:700,color:C.gold}}>{v}</span>
            </div>
          ))}
          <button className="bgh" style={{marginTop:12,width:"100%",textAlign:"center"}}>Edit Rules</button>
        </div>
      </div>}
      {tab==="tiers"&&<div className="sec">
        {LOYALTY_TIERS.map(t=>(
          <div key={t.name} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:18,marginBottom:14,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,width:4,height:"100%",background:t.color,borderRadius:"16px 0 0 16px"}}/>
            <div style={{paddingLeft:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <p className="pf" style={{fontSize:18,fontWeight:700,color:t.color}}>{t.name}</p>
                <span style={{fontSize:12,color:C.muted}}>{t.min}–{t.max===99999?"∞":t.max} pts</span>
              </div>
              {t.perks.map(p=><p key={p} style={{fontSize:13,color:C.text,padding:"3px 0"}}>✓ {p}</p>)}
              <div style={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.muted}}>{tierCounts.find(x=>x.name===t.name)?.count||0} members</span>
                <button className="bgh" style={{fontSize:11,padding:"5px 10px"}}>Edit Tier</button>
              </div>
            </div>
          </div>
        ))}
      </div>}
      {tab==="activity"&&<div className="sec">
        <p className="stit">Recent Activity</p>
        {[
          {name:"Marcus J.",action:"Earned 450 pts",sub:"Fade + Beard · Feb 15",icon:"➕",color:C.green},
          {name:"Tre L.",action:"Redeemed reward",sub:"Free Beard Trim · Feb 14",icon:"🎁",color:C.gold},
          {name:"DeShawn W.",action:"Reached Silver",sub:"200 pts milestone · Feb 12",icon:"🏆",color:"#9E9E9E"},
          {name:"Carlos M.",action:"Earned 250 pts",sub:"Color · Feb 10",icon:"➕",color:C.green},
          {name:"Joey T.",action:"Joined program",sub:"Bronze tier · Feb 5",icon:"✂️",color:C.orange},
        ].map((a,i)=>(
          <div key={i} className="txrow">
            <div style={{width:38,height:38,borderRadius:50,background:`${a.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{a.icon}</div>
            <div style={{flex:1}}><p style={{fontSize:14,fontWeight:600}}>{a.name}</p><p style={{fontSize:12,color:C.muted}}>{a.sub}</p></div>
            <span style={{fontSize:13,fontWeight:700,color:a.color}}>{a.action}</span>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ══════════════════════════════════════════
// GIFT CARDS & PROMOS (v4 preserved)
// ══════════════════════════════════════════
function GiftCardsScreen({onBack}){
  const [tab,setTab]=useState("cards");
  const [cards]=useState(GIFT_CARDS_INIT);
  const [createOpen,setCreateOpen]=useState(false);
  const [gcAmt,setGcAmt]=useState("50");
  const [gcTo,setGcTo]=useState("");
  const [created,setCreated]=useState(false);
  const [promoOpen,setPromoOpen]=useState(false);
  const GC_AMOUNTS=[25,50,75,100];
  const PROMOS=[
    {id:1,name:"Valentine's Flash",disc:"$5 off",code:"LOVE5",uses:12,active:true,expires:"Feb 28"},
    {id:2,name:"New Client Welcome",disc:"10% off",code:"NEWCLIENT",uses:8,active:true,expires:"Mar 31"},
    {id:3,name:"Referral Bonus",disc:"$10 off",code:"MARC47REF",uses:3,active:true,expires:"Ongoing"},
  ];
  return(
    <div className="screen screen-enter">
      <div className="hdr" style={{paddingBottom:16}}>
        {onBack&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onBack}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Gift Cards & Promos</h2>
          <div style={{width:60}}/>
        </div>}
        {!onBack&&<h2 className="pf" style={{fontSize:24,fontWeight:700,marginBottom:4}}>Gift Cards & Promos</h2>}
        <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Grow your client base with smart offers</p>
        <div className="ptabs">{["cards","promos"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>)}</div>
      </div>
      {tab==="cards"&&<div className="sec">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p className="stit" style={{marginBottom:0}}>Active Gift Cards</p>
          <button className="bgh" style={{fontSize:12}} onClick={()=>setCreateOpen(true)}>+ Create</button>
        </div>
        {cards.map(card=>(
          <div key={card.id} className="gc-card" style={{background:"linear-gradient(135deg,#1A1200,#2A1F00)",border:"1px solid rgba(201,168,76,.3)",marginBottom:14}}>
            <div className="gc-shine"/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <p style={{fontSize:11,color:"rgba(201,168,76,.6)",fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>Chop-It-Up Gift Card</p>
                <p className="pf" style={{fontSize:32,fontWeight:700,color:C.gold,marginTop:4}}>${card.balance}</p>
                <p style={{fontSize:12,color:"rgba(201,168,76,.5)"}}>of ${card.amount} remaining</p>
              </div>
              <div style={{textAlign:"right"}}><span className="badge bgrn">Active</span><p style={{fontSize:11,color:"rgba(201,168,76,.5)",marginTop:6}}>{card.created}</p></div>
            </div>
            <div style={{marginTop:16}}>
              <p style={{fontSize:11,color:"rgba(201,168,76,.5)",marginBottom:4}}>{card.purchaser}</p>
              <p style={{fontFamily:"monospace",fontSize:14,color:C.gold,letterSpacing:2}}>{card.code}</p>
            </div>
            <div style={{marginTop:6}}><div className="pb"><div className="pbf" style={{width:`${(card.balance/card.amount)*100}%`}}/></div></div>
          </div>
        ))}
        <div className="sgrid" style={{marginBottom:16}}>
          <div className="sc"><p style={{fontSize:11,color:C.muted}}>Total Issued</p><p className="pf" style={{fontSize:22,fontWeight:700,color:C.gold}}>$80</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>2 active cards</p></div>
          <div className="sc"><p style={{fontSize:11,color:C.muted}}>Redeemed</p><p className="pf" style={{fontSize:22,fontWeight:700,color:C.green}}>$18</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>of $80 used</p></div>
        </div>
      </div>}
      {tab==="promos"&&<div className="sec">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p className="stit" style={{marginBottom:0}}>Active Promotions</p>
          <button className="bgh" style={{fontSize:12}} onClick={()=>setPromoOpen(true)}>+ New Promo</button>
        </div>
        {PROMOS.map(p=>(
          <div key={p.id} className="card" style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div><p style={{fontSize:15,fontWeight:700}}>{p.name}</p><p style={{fontSize:12,color:C.muted}}>Expires: {p.expires}</p></div>
              <div style={{textAlign:"right"}}><span className="badge bgrn">Active</span><p style={{fontSize:12,color:C.muted,marginTop:4}}>{p.uses} uses</p></div>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{flex:1,background:C.bg,borderRadius:8,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontFamily:"monospace",fontSize:13,color:C.gold,fontWeight:700}}>{p.code}</span>
                <span style={{fontSize:13,fontWeight:700,color:C.green}}>{p.disc}</span>
              </div>
              <button className="bdgr" style={{borderRadius:8,padding:"8px 10px",fontSize:12}}>End</button>
            </div>
          </div>
        ))}
        <div style={{background:"rgba(201,168,76,.05)",border:"1px dashed rgba(201,168,76,.2)",borderRadius:14,padding:16}}>
          <p style={{fontSize:13,fontWeight:600,marginBottom:4}}>💡 Promo Ideas</p>
          <p style={{fontSize:12,color:C.muted,lineHeight:1.6}}>First-time client 15% off · Birthday week discount · Refer a friend $10 off · Monday slow-day special · Back-to-school flash deal</p>
        </div>
      </div>}
      {createOpen&&<div className="ov" onClick={()=>setCreateOpen(false)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        {!created?<>
          <h3 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:20}}>Create Gift Card</h3>
          <p className="stit">Select Amount</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
            {GC_AMOUNTS.map(a=>(
              <div key={a} onClick={()=>setGcAmt(String(a))} style={{background:gcAmt===String(a)?"rgba(201,168,76,.12)":C.card,border:`1px solid ${gcAmt===String(a)?C.gold:C.border}`,borderRadius:12,padding:"14px 0",textAlign:"center",cursor:"pointer",transition:"all .2s"}}>
                <p className="pf" style={{fontSize:18,fontWeight:700,color:gcAmt===String(a)?C.gold:C.text}}>${a}</p>
              </div>
            ))}
          </div>
          <div style={{marginBottom:20}}><label className="lbl">Send to (optional)</label><input className="inp" placeholder="Client name or phone" value={gcTo} onChange={e=>setGcTo(e.target.value)}/></div>
          <button className="btn bg" onClick={()=>setCreated(true)}>Generate Gift Card</button>
        </>:<>
          <div style={{textAlign:"center",padding:"10px 0 20px"}}>
            <div style={{fontSize:48,marginBottom:12}}>🎁</div>
            <h3 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:4}}>Gift Card Created!</h3>
            <p style={{fontSize:13,color:C.muted,marginBottom:20}}>${gcAmt} · {gcTo||"Ready to send"}</p>
            <div style={{background:"linear-gradient(135deg,#1A1200,#2A1F00)",border:"1px solid rgba(201,168,76,.3)",borderRadius:14,padding:16,marginBottom:20}}>
              <p style={{fontFamily:"monospace",fontSize:20,color:C.gold,letterSpacing:3,fontWeight:700}}>CHOP-{Math.floor(Math.random()*9000)+1000}</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button className="bo" style={{padding:"11px",fontSize:13}} onClick={()=>{setCreated(false);setCreateOpen(false);}}>Done</button>
              <button className="btn bg" style={{padding:"11px",fontSize:13}}>📤 Share</button>
            </div>
          </div>
        </>}
      </div></div>}
      {promoOpen&&<div className="ov" onClick={()=>setPromoOpen(false)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <h3 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:20}}>New Promotion</h3>
        <div style={{marginBottom:12}}><label className="lbl">Promo Name</label><input className="inp" placeholder="e.g. Spring Flash Sale"/></div>
        <div style={{marginBottom:12}}><label className="lbl">Discount Type</label><select className="sel"><option>Fixed amount off (e.g. $5 off)</option><option>Percentage off (e.g. 10% off)</option><option>Free service</option></select></div>
        <div style={{marginBottom:12}}><label className="lbl">Discount Value</label><input className="inp" placeholder="e.g. 10" type="number"/></div>
        <div style={{marginBottom:12}}><label className="lbl">Promo Code</label><input className="inp" placeholder="e.g. SPRING10"/></div>
        <div style={{marginBottom:20}}><label className="lbl">Expires</label><input className="inp" type="date"/></div>
        <button className="btn bg" onClick={()=>setPromoOpen(false)}>Create Promotion</button>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════
// ANALYTICS (v4 preserved + polished)
// ══════════════════════════════════════════
function AnalyticsScreen(){
  const [tab,setTab]=useState("revenue");
  const maxMonthly=Math.max(...MONTHLY_DATA);
  return(
    <div className="screen screen-enter">
      <div className="hdr" style={{paddingBottom:16}}>
        <h2 className="pf" style={{fontSize:24,fontWeight:700,marginBottom:4}}>Analytics</h2>
        <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Your business at a glance</p>
        <div className="ptabs">{["revenue","clients","services","growth"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>)}</div>
      </div>
      {tab==="revenue"&&<div className="sec">
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div>
              <p style={{fontSize:11,color:C.muted}}>2025 Total Revenue</p>
              <p className="pf" style={{fontSize:30,fontWeight:700,color:C.gold}}>$18,540</p>
              <p style={{fontSize:12,color:C.green,marginTop:2}}>↑ 31% vs last year</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:11,color:C.muted}}>Best Month</p>
              <p style={{fontSize:14,fontWeight:700}}>December</p>
              <p style={{fontSize:12,color:C.gold}}>$2,380</p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:100,marginBottom:6}}>
            {MONTHLY_DATA.map((v,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:"100%",borderRadius:"4px 4px 0 0",background:i===MONTHLY_DATA.length-1?`linear-gradient(180deg,${C.gold},${C.goldDim})`:C.card,height:`${(v/maxMonthly)*90}px`,transition:"height .5s",border:i===MONTHLY_DATA.length-1?"none":`1px solid ${C.border}`}}/>
                <span style={{fontSize:9,color:C.muted}}>{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="sgrid" style={{marginBottom:16}}>
          {[["Avg Monthly","$1,545","revenue"],["Avg per Client","$45","ticket"],["Tip Rate","22%","of total"],["Processing Fees","2.7%","Stripe avg"]].map(([l,v,s])=>(
            <div key={l} className="sc"><p style={{fontSize:11,color:C.muted}}>{l}</p><p className="pf" style={{fontSize:20,fontWeight:700,color:C.gold,marginTop:4}}>{v}</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>{s}</p></div>
          ))}
        </div>
      </div>}
      {tab==="clients"&&<div className="sec">
        <div className="sgrid" style={{marginBottom:16}}>
          {[["Total Clients","247","all time"],["Active (30d)","89","last 30 days"],["New (30d)","12","this month"],["Retention","84%","come back"]].map(([l,v,s])=>(
            <div key={l} className="sc"><p style={{fontSize:11,color:C.muted}}>{l}</p><p className="pf" style={{fontSize:20,fontWeight:700,color:C.gold,marginTop:4}}>{v}</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>{s}</p></div>
          ))}
        </div>
        <div className="card" style={{marginBottom:16}}>
          <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>Client Acquisition</p>
          {[["Online Booking Link","42%",C.blue],["Word of Mouth","31%",C.green],["Instagram","18%",C.pink],["Walk-in","9%",C.muted]].map(([src,pct,col])=>(
            <div key={src} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13}}>{src}</span><span style={{fontSize:13,fontWeight:700,color:col}}>{pct}</span></div>
              <div className="pb"><div style={{height:"100%",background:col,borderRadius:2,width:pct,transition:"width .6s ease"}}/></div>
            </div>
          ))}
        </div>
      </div>}
      {tab==="services"&&<div className="sec">
        <div className="card" style={{marginBottom:16}}>
          <p style={{fontSize:14,fontWeight:700,marginBottom:14}}>Revenue by Service</p>
          {[["Fade","$5,820","38%",C.gold],["Haircut","$3,240","21%",C.blue],["Braids","$2,850","19%",C.purple],["Color","$2,310","15%",C.pink],["Beard Trim","$1,020","7%",C.green]].map(([s,rev,pct,col])=>(
            <div key={s} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:13,fontWeight:600}}>{s}</span>
                <div style={{display:"flex",gap:12}}><span style={{fontSize:12,color:C.muted}}>{pct}</span><span style={{fontSize:13,fontWeight:700,color:col}}>{rev}</span></div>
              </div>
              <div className="pb"><div style={{height:"100%",background:col,borderRadius:2,width:pct,transition:"width .6s ease"}}/></div>
            </div>
          ))}
        </div>
        <div className="sgrid">
          {[["Most Booked","Fade","142 this yr"],["Highest Tip","Braids","avg $22 tip"],["Best Day","Saturday","31% of revenue"],["Peak Hour","11AM–1PM","most bookings"]].map(([l,v,s])=>(
            <div key={l} className="sc"><p style={{fontSize:11,color:C.muted}}>{l}</p><p style={{fontSize:16,fontWeight:700,color:C.gold,marginTop:4}}>{v}</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>{s}</p></div>
          ))}
        </div>
      </div>}
      {tab==="growth"&&<div className="sec">
        <div className="card" style={{marginBottom:16,background:"linear-gradient(135deg,rgba(201,168,76,.1),rgba(201,168,76,.03))",borderColor:"rgba(201,168,76,.25)"}}>
          <p style={{fontSize:13,color:C.gold,fontWeight:700,marginBottom:4}}>📈 Growth Score</p>
          <p className="pf" style={{fontSize:42,fontWeight:700,color:C.gold,lineHeight:1}}>87<span style={{fontSize:18,color:C.muted}}>/100</span></p>
          <p style={{fontSize:12,color:C.muted,marginTop:4,marginBottom:12}}>Excellent — top 15% of barbers on Chop-It-Up</p>
          <div className="pb"><div className="pbf" style={{width:"87%"}}/></div>
        </div>
        <p className="stit">Growth Metrics</p>
        {[
          {label:"Month-over-month revenue",value:"+22%",color:C.green},
          {label:"New client rate",value:"+12/mo",color:C.green},
          {label:"Review score",value:"4.9 ★",color:C.gold},
          {label:"Rebooking rate",value:"84%",color:C.green},
          {label:"No-show rate",value:"3%",color:C.green},
          {label:"Avg ticket growth",value:"+$8 MoM",color:C.green},
        ].map(m=>(
          <div key={m.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:13,color:C.muted}}>{m.label}</span>
            <span style={{fontSize:14,fontWeight:700,color:m.color}}>{m.value}</span>
          </div>
        ))}
        <div className="card" style={{marginTop:16,marginBottom:20}}>
          <p style={{fontSize:14,fontWeight:700,marginBottom:10}}>💡 AI Recommendations</p>
          {["Add a Monday promo — your slowest day. A 10% discount could fill 3+ slots.","You haven't posted on Instagram in 8 days. Your last post drove 4 new bookings.","3 clients are overdue for their regular cut. Tap to send a reminder."].map((r,i)=>(
            <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:i<2?`1px solid ${C.border}`:"none"}}>
              <span style={{fontSize:16,flexShrink:0}}>✨</span>
              <p style={{fontSize:12,color:C.text,lineHeight:1.5}}>{r}</p>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}

// ══════════════════════════════════════════
// ADMIN DASHBOARD (v4 preserved)
// ══════════════════════════════════════════
function AdminDashboard({onClose}){
  const [tab,setTab]=useState("overview");
  const totalRev=ADMIN_BARBERS.reduce((s,b)=>s+b.revenue,0);
  const totalAppts=ADMIN_BARBERS.reduce((s,b)=>s+b.appts,0);
  return(
    <div className="modfull">
      <div style={{background:"linear-gradient(135deg,#0A0800,#150F00)",borderBottom:"1px solid rgba(201,168,76,.2)",padding:"16px 20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(201,168,76,.2)",color:C.text,borderRadius:10,padding:"6px 12px",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>←</button>
            <div>
              <p className="pf" style={{fontSize:18,fontWeight:700,color:C.gold}}>Admin Dashboard</p>
              <p style={{fontSize:11,color:C.muted}}>Chop-It-Up · Owner View</p>
            </div>
          </div>
          <span className="badge bgold">Owner</span>
        </div>
        <div className="ptabs" style={{background:"rgba(255,255,255,.05)"}}>
          {["overview","barbers","payouts","settings"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",fontSize:11}}>{t}</div>)}
        </div>
      </div>
      <div style={{padding:"20px 20px",paddingBottom:40,overflowY:"auto"}}>
        {tab==="overview"&&<>
          <div className="sgrid" style={{marginBottom:16}}>
            {[
              {l:"Monthly Revenue",v:`$${totalRev.toLocaleString()}`,s:"all barbers",c:C.gold,ac:"#C9A84C22"},
              {l:"Total Appointments",v:totalAppts,s:"this month",c:C.blue,ac:"#5B9CF622"},
              {l:"Active Barbers",v:ADMIN_BARBERS.filter(b=>b.active).length,s:"on platform",c:C.green,ac:"#4CAF7A22"},
              {l:"Platform Subscribers",v:"3",s:"@ $10/mo",c:C.purple,ac:"#A78BFA22"},
            ].map(m=>(
              <div key={m.l} className="admin-metric" style={{background:m.ac,border:`1px solid ${m.c}33`}}>
                <p style={{fontSize:11,color:C.muted,marginBottom:4}}>{m.l}</p>
                <p className="pf" style={{fontSize:22,fontWeight:700,color:m.c}}>{m.v}</p>
                <p style={{fontSize:11,color:C.muted,marginTop:4}}>{m.s}</p>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:16,background:"linear-gradient(135deg,rgba(167,139,250,.1),rgba(167,139,250,.03))",borderColor:"rgba(167,139,250,.25)"}}>
            <p style={{fontSize:13,fontWeight:700,color:C.purple,marginBottom:12}}>💼 Your Platform Revenue</p>
            <div style={{display:"flex",gap:20}}>
              {[["Subscriptions","$30/mo","3 barbers × $10"],["Annual Run Rate","$360/yr","if same barbers"],["Referral Credits","$10","1 referral earned"],["Total Collected","$60","since launch"]].map(([l,v,s])=>(
                <div key={l} style={{flex:1,textAlign:"center"}}>
                  <p className="pf" style={{fontSize:16,fontWeight:700,color:C.purple}}>{v}</p>
                  <p style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <p style={{fontSize:13,fontWeight:600,marginBottom:12}}>Platform Bookings — This Week</p>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
              {WEEKLY.map((h,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                  <div className={`bar${i===6?"":" dim"}`} style={{height:`${(h/145)*70}px`,width:"100%"}}/>
                  <span style={{fontSize:10,color:C.muted}}>{DAYS[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </>}
        {tab==="barbers"&&<>
          <p className="stit">{ADMIN_BARBERS.length} Barbers on Platform</p>
          {ADMIN_BARBERS.map(b=>(
            <div key={b.id} className="card" style={{marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
                <div className="pav" style={{width:48,height:48,fontSize:20,background:`linear-gradient(135deg,${b.color},${b.color}88)`}}>{b.avatar}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                    <p style={{fontSize:15,fontWeight:700}}>{b.name}</p>
                    <span className="badge bgold" style={{fontSize:9}}>{b.role}</span>
                    <span className={`badge ${b.active?"bgrn":"bred"}`} style={{fontSize:9}}>{b.active?"Active":"Inactive"}</span>
                  </div>
                  <p style={{fontSize:12,color:C.muted}}>Rating: {b.rating}★ · {b.appts} appts this month</p>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:0,background:C.surface,borderRadius:10,overflow:"hidden"}}>
                {[["Revenue",`$${b.revenue.toLocaleString()}`],["Appts",b.appts],["Rating",`${b.rating}★`]].map(([l,v],i)=>(
                  <div key={l} style={{padding:"10px 0",textAlign:"center",borderRight:i<2?`1px solid ${C.border}`:"none"}}>
                    <p className="pf" style={{fontSize:15,fontWeight:700,color:b.color}}>{v}</p>
                    <p style={{fontSize:10,color:C.muted}}>{l}</p>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
                <button className="bgh" style={{fontSize:12,padding:"8px"}}>View Profile</button>
                <button className="bo" style={{fontSize:12,padding:"8px",borderRadius:8}}>Message</button>
              </div>
            </div>
          ))}
          <button className="btn bg" style={{marginTop:4}}>+ Invite a Barber</button>
        </>}
        {tab==="payouts"&&<>
          <p className="stit">Payout Summary — February 2026</p>
          <div className="card" style={{marginBottom:16}}>
            {ADMIN_BARBERS.map((b,i)=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<ADMIN_BARBERS.length-1?`1px solid ${C.border}`:"none"}}>
                <div className="pav" style={{width:36,height:36,fontSize:15,background:`linear-gradient(135deg,${b.color},${b.color}88)`,flexShrink:0}}>{b.avatar}</div>
                <div style={{flex:1}}><p style={{fontSize:14,fontWeight:600}}>{b.name}</p><p style={{fontSize:11,color:C.muted}}>{b.appts} appts · {b.role}</p></div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontSize:15,fontWeight:700,color:C.gold}}>${(b.revenue*0.97).toLocaleString()}</p>
                  <p style={{fontSize:10,color:C.muted}}>after 3% fee</p>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:16}}>
            {[["Total Processed",`$${totalRev.toLocaleString()}`],["Platform Fees (3%)",`$${Math.round(totalRev*0.03)}`],["Net Payouts",`$${Math.round(totalRev*0.97).toLocaleString()}`],["Next Payout","Feb 22, 2026"]].map(([k,v],i)=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:i<3?`1px solid ${C.border}`:"none"}}>
                <span style={{fontSize:13,color:C.muted}}>{k}</span>
                <span style={{fontSize:14,fontWeight:i===3?600:700,color:i===2?C.green:C.text}}>{v}</span>
              </div>
            ))}
          </div>
          <button className="btn bg">📄 Export Payout Report</button>
        </>}
        {tab==="settings"&&<>
          <p className="stit">Platform Settings</p>
          <div className="card" style={{marginBottom:16}}>
            {[["Subscription Price","$10/month"],["Platform Fee","3% per transaction"],["Payout Schedule","Weekly (Fridays)"],["SMS Rate","$0.02/message"],["Free Trial","14 days"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{k}</span>
                <span style={{fontSize:13,fontWeight:700,color:C.gold}}>{v}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:16}}>
            <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>Feature Flags</p>
            {[["Marketplace","Live"],["Referral Program","Live"],["Gift Cards","Beta"],["Multi-barber Shops","Coming Soon"]].map(([f,s])=>(
              <div key={f} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13}}>{f}</span>
                <span className={`badge ${s==="Live"?"bgrn":s==="Beta"?"borg":"bblu"}`} style={{fontSize:10}}>{s}</span>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
function Dashboard({onAdd,onAdmin,onBookingPage,onWaitlist,onNoShow,shopName="Fresh Cutz"}){
  const [online,setOnline]=useState(true);
  const total=TXS.filter(t=>t.date==="Today"&&t.type==="in").reduce((s,t)=>s+t.amount+t.tip,0);
  return(
    <div className="screen screen-enter">
      <div className="hdr">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
          <div>
            <p style={{fontSize:12,color:C.muted,marginBottom:2}}>Thursday, February 19</p>
            <h1 className="pf" style={{fontSize:26,fontWeight:700,lineHeight:1.15}}>Good morning,<br/>{shopName} 👋</h1>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div onClick={onAdmin} style={{background:"rgba(201,168,76,.1)",border:"1px solid rgba(201,168,76,.25)",borderRadius:10,padding:"7px 10px",cursor:"pointer",fontSize:13,fontWeight:600,color:C.gold}}>Admin</div>
            <div className="pav" style={{width:40,height:40,fontSize:16}}>M</div>
          </div>
        </div>

        {/* Status toggle */}
        <div style={{background:"rgba(201,168,76,.08)",border:"1px solid rgba(201,168,76,.2)",borderRadius:14,padding:"12px 16px",marginTop:16,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:online?C.green:C.red,boxShadow:`0 0 8px ${online?C.green:C.red}`}}/>
          <div style={{flex:1}}>
            <p style={{fontSize:13,fontWeight:600}}>{online?"Accepting Appointments":"Closed for Bookings"}</p>
            <p style={{fontSize:11,color:C.muted}}>4 appts today · $230 projected</p>
          </div>
          <Tog on={online} toggle={()=>setOnline(o=>!o)}/>
        </div>

        {/* No-show alert banner */}
        <div onClick={onNoShow} style={{background:"rgba(224,82,82,.06)",border:"1px solid rgba(224,82,82,.2)",borderRadius:12,padding:"10px 14px",marginTop:10,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
          <div className="alert-pulse" style={{width:8,height:8,borderRadius:"50%",background:C.red,flexShrink:0}}/>
          <div style={{flex:1}}>
            <p style={{fontSize:12,fontWeight:600,color:C.red}}>1 pending no-show fee · Carlos M. at 2:00 PM</p>
            <p style={{fontSize:11,color:C.dim}}>Tap to manage no-shows & fees</p>
          </div>
          <span style={{color:C.red,fontSize:14}}>›</span>
        </div>

        {/* Waitlist banner */}
        <div onClick={onWaitlist} style={{background:"rgba(91,156,246,.06)",border:"1px solid rgba(91,156,246,.15)",borderRadius:12,padding:"10px 14px",marginTop:8,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
          <span style={{fontSize:16}}>📋</span>
          <div style={{flex:1}}>
            <p style={{fontSize:12,fontWeight:600,color:C.blue}}>{WAITLIST_INIT.length} clients on waitlist</p>
            <p style={{fontSize:11,color:C.dim}}>Khalil R. is next · {WAITLIST_INIT[0]?.eta} wait</p>
          </div>
          <span className="badge bblu" style={{fontSize:10}}>{WAITLIST_INIT.length}</span>
        </div>
        <div onClick={onBookingPage} style={{background:"linear-gradient(135deg,rgba(91,156,246,.1),rgba(91,156,246,.04))",border:"1px solid rgba(91,156,246,.2)",borderRadius:12,padding:"10px 14px",marginTop:10,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
          <span style={{fontSize:18}}>🔗</span>
          <div style={{flex:1}}>
            <p style={{fontSize:12,fontWeight:600,color:C.blue}}>Preview Client Booking Page</p>
            <p style={{fontSize:11,color:C.dim}}>chopitup.app/marcus-barber</p>
          </div>
          <span style={{color:C.blue,fontSize:14}}>›</span>
        </div>
      </div>

      <div className="sec">
        <div className="sgrid">
          <div className="sc"><p style={{fontSize:11,color:C.muted}}>Today's Revenue</p><p className="pf" style={{fontSize:24,fontWeight:700,color:C.gold}}>${total.toFixed(0)}</p><p style={{fontSize:11,color:C.green,marginTop:4}}>↑ 18% vs last wk</p></div>
          <div className="sc"><p style={{fontSize:11,color:C.muted}}>Appts Today</p><p className="pf" style={{fontSize:24,fontWeight:700}}>4</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>2 remaining</p></div>
          <div className="sc"><p style={{fontSize:11,color:C.muted}}>Loyalty Members</p><p className="pf" style={{fontSize:24,fontWeight:700,color:C.purple}}>6</p><p style={{fontSize:11,color:C.purple,marginTop:4}}>1 Gold tier</p></div>
          <div className="sc"><p style={{fontSize:11,color:C.muted}}>Growth Score</p><p className="pf" style={{fontSize:24,fontWeight:700,color:C.green}}>87</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>top 15%</p></div>
        </div>
      </div>

      <div className="sec">
        <p className="stit">Quick Actions</p>
        <div className="qgrid">
          {[{icon:"➕",text:"Add Appt",a:onAdd},{icon:"📋",text:"Waitlist",a:onWaitlist},{icon:"🚫",text:"No-Shows",a:onNoShow},{icon:"🔗",text:"Book Link",a:onBookingPage}].map(q=>(
            <div key={q.text} className="qa" onClick={q.a}>
              <div style={{fontSize:22,marginBottom:6}}>{q.icon}</div>
              <div style={{fontSize:10,color:C.muted,fontWeight:500}}>{q.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sec">
        <p className="stit">Up Next</p>
        {INIT_APPTS.slice(0,2).map(a=>(
          <div key={a.id} className="aprow">
            <div style={{textAlign:"center",minWidth:48}}>
              <div style={{fontSize:17,fontWeight:700}}>{a.time.split(" ")[0]}</div>
              <div style={{fontSize:10,color:C.muted}}>{a.time.split(" ")[1]}</div>
            </div>
            <div style={{width:1,height:36,background:C.border}}/>
            <div style={{flex:1}}><p style={{fontSize:15,fontWeight:600}}>{a.name}</p><p style={{fontSize:12,color:C.muted}}>{a.service}{a.recurring&&<span style={{color:C.purple}}> · 🔄</span>}</p></div>
            <div style={{textAlign:"right"}}><p style={{fontSize:15,fontWeight:700,color:C.gold}}>${a.price}</p><span className="badge bgrn" style={{fontSize:10}}>Confirmed</span></div>
          </div>
        ))}
      </div>

      <div className="sec" style={{marginBottom:20}}>
        <p className="stit">This Week</p>
        <div className="card">
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div><p style={{fontSize:11,color:C.muted}}>Weekly Revenue</p><p className="pf" style={{fontSize:26,fontWeight:700,color:C.gold}}>$605</p></div>
            <span className="badge bgrn">↑ 22%</span>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
            {WEEKLY.map((h,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <div className={`bar${i===6?"":" dim"}`} style={{height:`${(h/145)*70}px`,width:"100%"}}/>
                <span style={{fontSize:10,color:C.muted}}>{DAYS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// APPOINTMENTS (with Waitlist tab + No-Show marking)
// ══════════════════════════════════════════
function Appointments({onAdd,onWaitlist,onNoShow}){
  const [appts,setAppts]=useState([]);
  const [waitlist,setWaitlist]=useState([]);
  const [sel,setSel]=useState(null);
  const [tab,setTab]=useState("today");
  const [toast,setToast]=useState("");
  const [cancelFlow,setCancelFlow]=useState(null);
  const [notifyWL,setNotifyWL]=useState(false);
  const [dbLoading,setDbLoading]=useState(true);

  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),2500);};

  // Load from Parse on mount
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const [a,w]=await Promise.all([
          ParseService.getAppointments(),
          ParseService.getWaitlist(),
        ]);
        if(!cancelled){ setAppts(a.length?a:INIT_APPTS); setWaitlist(w.length?w:WAITLIST_INIT); }
      } catch(e){
        // Offline or no session — fall back to mock data
        if(!cancelled){ setAppts(INIT_APPTS); setWaitlist(WAITLIST_INIT); }
      } finally {
        if(!cancelled) setDbLoading(false);
      }
    })();
    return()=>{cancelled=true;};
  },[]);

  const handleCancel=async(appt)=>{
    setAppts(a=>a.filter(x=>x.id!==appt.id));
    setSel(null);
    try{ if(appt.id && !String(appt.id).match(/^\d+$/)) await ParseService.deleteAppointment(appt.id); } catch(e){}
    if(waitlist.length>0){setCancelFlow(appt);setNotifyWL(true);}
    else showToast("Appointment cancelled");
  };

  const handleMarkNoShow=async(appt)=>{
    setAppts(a=>a.filter(x=>x.id!==appt.id));
    setSel(null);
    try{ if(appt.id && !String(appt.id).match(/^\d+$/)) await ParseService.deleteAppointment(appt.id); } catch(e){}
    showToast(`${appt.name} marked as no-show`);
  };

  return(
    <div className="screen screen-enter">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 className="pf" style={{fontSize:24,fontWeight:700}}>Appointments</h2>
          <div style={{display:"flex",gap:8}}>
            {/* Waitlist quick-access badge */}
            <button onClick={onWaitlist} style={{position:"relative",background:"rgba(91,156,246,.1)",border:"1px solid rgba(91,156,246,.25)",color:C.blue,borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:5}}>
              📋 <span>WL</span>
              <span style={{position:"absolute",top:-4,right:-4,width:16,height:16,background:C.red,borderRadius:"50%",fontSize:9,fontWeight:700,color:"white",display:"flex",alignItems:"center",justifyContent:"center"}}>{waitlist.length}</span>
            </button>
            <button className="bgh" onClick={onAdd}>+ New</button>
          </div>
        </div>
        <div className="ptabs">
          {["today","upcoming","recurring","waitlist"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",position:"relative"}}>
              {t}
              {t==="waitlist"&&waitlist.length>0&&<div style={{position:"absolute",top:2,right:4,width:6,height:6,background:C.blue,borderRadius:"50%"}}/>}
            </div>
          ))}
        </div>
      </div>
      <div className="sec">
        {(tab==="today"||tab==="upcoming")&&<>
          <p className="stit">{`Thursday, Feb 19 · ${appts.length} appts`}</p>
          {appts.map(a=>(
            <div key={a.id} className="aprow" onClick={()=>setSel(a)}>
              <div style={{textAlign:"center",minWidth:48}}><div style={{fontSize:17,fontWeight:700}}>{a.time.split(" ")[0]}</div><div style={{fontSize:10,color:C.muted}}>{a.time.split(" ")[1]}</div></div>
              <div style={{width:1,height:36,background:C.border}}/>
              <div style={{flex:1}}><p style={{fontSize:15,fontWeight:600}}>{a.name}</p><p style={{fontSize:12,color:C.muted}}>{a.service}{a.recurring&&<span style={{color:C.purple}}> · 🔄</span>}</p></div>
              <div style={{textAlign:"right"}}><p style={{fontSize:15,fontWeight:700,color:C.gold}}>${a.price}</p><span className="badge bgrn" style={{fontSize:10}}>✓</span></div>
            </div>
          ))}
          <div style={{border:`1px dashed ${C.border}`,borderRadius:14,padding:14,textAlign:"center",cursor:"pointer"}} onClick={onAdd}>
            <p style={{fontSize:13,color:C.dim}}>+ Open slot at 5:00 PM — tap to fill</p>
          </div>
        </>}

        {tab==="recurring"&&<>
          <p className="stit">{`${appts.filter(a=>a.recurring).length} Recurring`}</p>
          {appts.filter(a=>a.recurring).map(a=>(
            <div key={a.id} className="aprow" onClick={()=>setSel(a)}>
              <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(167,139,250,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🔄</div>
              <div style={{flex:1}}><p style={{fontSize:15,fontWeight:600}}>{a.name}</p><p style={{fontSize:12,color:C.muted}}>{a.service}</p></div>
              <div style={{textAlign:"right"}}><p style={{fontSize:15,fontWeight:700,color:C.gold}}>${a.price}</p><span className="badge bpur" style={{fontSize:10}}>{a.recurring}</span></div>
            </div>
          ))}
        </>}

        {/* ── INLINE WAITLIST TAB ── */}
        {tab==="waitlist"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <p className="stit" style={{marginBottom:0}}>{waitlist.length} in queue</p>
            <button onClick={onWaitlist} style={{background:"rgba(91,156,246,.1)",border:"1px solid rgba(91,156,246,.25)",color:C.blue,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Full View →</button>
          </div>
          {waitlist.map((w)=>(
            <div key={w.id} className="wl-card" onClick={onWaitlist}>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div className={`wl-rank${w.position===1?" r1":w.position===2?" r2":" rn"}`}>#{w.position}</div>
                <div style={{width:38,height:38,borderRadius:"50%",background:`${w.color}22`,border:`1px solid ${w.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:w.color,flexShrink:0,fontFamily:"'Playfair Display',serif"}}>{w.avatar}</div>
                <div style={{flex:1}}>
                  <p style={{fontSize:14,fontWeight:700}}>{w.name} {w.priority==="vip"&&"⭐"}</p>
                  <p style={{fontSize:12,color:C.muted}}>{w.service} · {w.eta}</p>
                </div>
                {!w.notified?<span style={{fontSize:11,color:C.muted}}>Not notified</span>:<span style={{fontSize:11,color:C.green}}>✓ Notified</span>}
              </div>
            </div>
          ))}
          <button className="btn bg" style={{marginTop:8}} onClick={onWaitlist}>Manage Full Waitlist</button>
        </>}
      </div>

      {/* Appointment detail modal */}
      {sel&&<div className="ov" onClick={()=>setSel(null)}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <div><h3 className="pf" style={{fontSize:22,fontWeight:700}}>{sel.name}</h3><p style={{color:C.muted,fontSize:13}}>{sel.time} · {sel.service}</p></div>
          <span className="badge bgrn">Confirmed</span>
        </div>
        <div className="card" style={{marginBottom:16}}>
          {[["Phone",sel.phone],["Service",sel.service],["Price",`$${sel.price}`],["Recurring",sel.recurring||"One-time"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.muted}}>{k}</span><span style={{fontSize:13,fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <button className="btn bg" style={{fontSize:13,padding:"11px"}} onClick={()=>{showToast("Charge sent!");setSel(null);}}>💰 Charge</button>
          <button className="bo" style={{fontSize:13,padding:"11px"}} onClick={()=>{showToast("Reminder sent!");setSel(null);}}>📱 Remind</button>
        </div>
        <button style={{width:"100%",padding:"12px",borderRadius:12,marginBottom:8,background:"rgba(224,82,82,.1)",border:"1px solid rgba(224,82,82,.3)",color:C.red,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600}} onClick={()=>handleMarkNoShow(sel)}>🚫 Mark as No-Show</button>
        <button className="bdgr" style={{width:"100%",padding:"12px",borderRadius:12}} onClick={()=>handleCancel(sel)}>Cancel Appointment</button>
      </div></div>}

      {/* Cancel → Waitlist notification offer */}
      {notifyWL&&cancelFlow&&<div className="ov" onClick={()=>{setNotifyWL(false);setCancelFlow(null);}}><div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:4}}>Slot opened up!</h3>
          <p style={{fontSize:13,color:C.muted}}>{cancelFlow.time} is now available</p>
        </div>
        <div className="card" style={{marginBottom:16}}>
          <p style={{fontSize:13,fontWeight:600,marginBottom:10}}>Next on waitlist</p>
          {waitlist.slice(0,1).map(w=>(
            <div key={w.id} style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{width:40,height:40,borderRadius:"50%",background:`${w.color}22`,border:`1px solid ${w.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:w.color,fontFamily:"'Playfair Display',serif"}}>{w.avatar}</div>
              <div><p style={{fontSize:14,fontWeight:600}}>{w.name}</p><p style={{fontSize:12,color:C.muted}}>{w.service} · #{w.position} in queue</p></div>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button className="bo" style={{padding:"12px",fontSize:13}} onClick={()=>{setNotifyWL(false);setCancelFlow(null);showToast("Appointment cancelled");}}>Skip</button>
          <button className="btn bg" style={{padding:"12px",fontSize:13}} onClick={()=>{setNotifyWL(false);setCancelFlow(null);showToast(`SMS sent to ${waitlist[0]?.name}!`);}}>📱 Notify Them</button>
        </div>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════
// PAYMENTS (v4 preserved)
// ══════════════════════════════════════════
function Payments(){
  const [tab,setTab]=useState("transactions");
  const [chargeOpen,setChargeOpen]=useState(false);
  const [amt,setAmt]=useState("");
  const [tipSel,setTipSel]=useState(null);
  const [svc,setSvc]=useState("Haircut");
  const [step,setStep]=useState(1);
  const mTotal=TXS.filter(t=>t.type==="in").reduce((s,t)=>s+t.amount+t.tip,0);
  const tips=[{l:"15%",v:Math.round(parseFloat(amt||0)*.15*100)/100},{l:"20%",v:Math.round(parseFloat(amt||0)*.2*100)/100},{l:"25%",v:Math.round(parseFloat(amt||0)*.25*100)/100},{l:"No Tip",v:0}];
  return(
    <div className="screen screen-enter">
      <div className="hdr" style={{paddingBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 className="pf" style={{fontSize:24,fontWeight:700}}>Payments</h2>
          <button className="btn bg" style={{width:"auto",padding:"9px 18px",fontSize:13}} onClick={()=>{setChargeOpen(true);setStep(1);}}>⚡ Charge</button>
        </div>
        <div style={{background:"linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.05))",border:"1px solid rgba(201,168,76,.2)",borderRadius:16,padding:18,marginBottom:4}}>
          <p style={{fontSize:11,color:C.gold,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>February 2026</p>
          <p className="pf" style={{fontSize:36,fontWeight:700,marginTop:4}}>${mTotal.toFixed(0)}</p>
          <div style={{display:"flex",gap:20,marginTop:10}}>
            <div><p style={{fontSize:11,color:C.muted}}>Services</p><p style={{fontSize:15,fontWeight:600}}>${(mTotal-36).toFixed(0)}</p></div>
            <div><p style={{fontSize:11,color:C.muted}}>Tips</p><p style={{fontSize:15,fontWeight:600,color:C.green}}>$36</p></div>
            <div><p style={{fontSize:11,color:C.muted}}>Clients</p><p style={{fontSize:15,fontWeight:600}}>4</p></div>
          </div>
        </div>
        <div className="ptabs" style={{marginTop:16}}>
          {["transactions","analytics","tax"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>)}
        </div>
      </div>
      {tab==="transactions"&&<div className="sec">
        {TXS.map(tx=>(
          <div key={tx.id} className="txrow">
            <div style={{width:38,height:38,borderRadius:"50%",background:tx.type==="in"?"rgba(76,175,122,.1)":"rgba(224,82,82,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{tx.icon}</div>
            <div style={{flex:1}}><p style={{fontSize:14,fontWeight:600}}>{tx.name}</p><p style={{fontSize:12,color:C.muted}}>{tx.service} · {tx.date}</p></div>
            <div style={{textAlign:"right"}}><p style={{fontSize:15,fontWeight:700,color:tx.type==="in"?C.text:C.red}}>{tx.type==="in"?"+":"-"}${Math.abs(tx.amount).toFixed(2)}</p>{tx.tip>0&&<p style={{fontSize:11,color:C.green}}>+${tx.tip} tip</p>}</div>
          </div>
        ))}
      </div>}
      {tab==="analytics"&&<div className="sec"><div className="sgrid">{[["Avg Ticket","$45","per client"],["Tip Rate","23%","of revenue"],["Top Service","Fade","this month"],["Busiest Day","Sat","most bookings"]].map(([l,v,s])=><div key={l} className="sc"><p style={{fontSize:11,color:C.muted}}>{l}</p><p style={{fontSize:20,fontWeight:700,color:C.gold,marginTop:4}}>{v}</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>{s}</p></div>)}</div></div>}
      {tab==="tax"&&<div className="sec"><div className="card" style={{marginBottom:12}}>{[["Gross Income","$8,420"],["Business Expenses","$620"],["Net Income","$7,800"],["Est. Self-Employ. Tax","$1,193"],["Total Est. Tax Due","$2,129"]].map(([k,v],i)=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:i<4?`1px solid ${C.border}`:"none"}}><span style={{fontSize:13,color:C.muted}}>{k}</span><span style={{fontSize:14,fontWeight:i===4?700:600,color:i===4?C.red:C.text}}>{v}</span></div>)}</div><button className="btn bg">📄 Export CSV</button></div>}
      {chargeOpen&&<div className="ov" onClick={()=>setChargeOpen(false)}><div className="mod" onClick={e=>e.stopPropagation()}><div className="mh"/>
        {step===1&&<><h3 className="pf" style={{fontSize:22,marginBottom:20}}>New Charge</h3><div style={{marginBottom:14}}><label className="lbl">Service</label><select className="sel" value={svc} onChange={e=>setSvc(e.target.value)}>{SVCS.map(s=><option key={s.name}>{s.name}</option>)}</select></div><div style={{marginBottom:20}}><label className="lbl">Amount</label><input className="inp" type="number" placeholder="0.00" value={amt} onChange={e=>setAmt(e.target.value)} style={{fontSize:28,fontWeight:700,textAlign:"center"}}/></div><button className="btn bg" onClick={()=>setStep(2)} disabled={!amt}>Next →</button></>}
        {step===2&&<><h3 className="pf" style={{fontSize:22,marginBottom:4}}>Add a Tip?</h3><p style={{fontSize:13,color:C.muted,marginBottom:20}}>${parseFloat(amt||0).toFixed(2)} · {svc}</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>{tips.map(t=><div key={t.l} onClick={()=>setTipSel(t.v)} style={{background:tipSel===t.v?"rgba(201,168,76,.15)":C.card,border:`1px solid ${tipSel===t.v?C.gold:C.border}`,borderRadius:12,padding:14,textAlign:"center",cursor:"pointer"}}><p style={{fontSize:18,fontWeight:700,color:tipSel===t.v?C.gold:C.text}}>{t.l}</p>{t.v>0&&<p style={{fontSize:12,color:C.muted}}>${t.v.toFixed(2)}</p>}</div>)}</div>{tipSel!==null&&<div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderTop:`1px solid ${C.border}`,marginBottom:16}}><span style={{fontSize:16,fontWeight:600}}>Total</span><span className="pf" style={{fontSize:22,fontWeight:700,color:C.gold}}>${(parseFloat(amt)+(tipSel||0)).toFixed(2)}</span></div>}<button className="btn bg" onClick={()=>{setChargeOpen(false);setAmt("");setTipSel(null);setStep(1);}}>💳 Send to Reader</button></>}
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════
// MARKETING (v4 preserved)
// ══════════════════════════════════════════
function Marketing({onBack}){
  const [tab,setTab]=useState("sms");
  const [msg,setMsg]=useState("");
  const [sent,setSent]=useState(false);
  const TMPLS=[{l:"Open Slots",t:"Hey! Got open slots this week. Book at chopitup.app/marcus ✂️"},{l:"Flash Deal",t:"FLASH DEAL 🔥 $5 off this weekend! Reply BOOK to claim."},{l:"Loyalty",t:"You've earned enough points for a FREE service! Book now to redeem 🎉"}];
  const send=()=>{setSent(true);setTimeout(()=>{setSent(false);setMsg("");},3000);};
  return(
    <div className="screen screen-enter">
      <div className="hdr" style={{paddingBottom:16}}>
        {onBack&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onBack}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Marketing</h2>
          <div style={{width:60}}/>
        </div>}
        {!onBack&&<h2 className="pf" style={{fontSize:24,fontWeight:700,marginBottom:4}}>Marketing</h2>}
        <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Reach your clients with one tap</p>
        <div className="ptabs">{["sms","new clients","social"].map(t=><div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>)}</div>
      </div>
      {tab==="sms"&&<div className="sec">
        {[{icon:"👥",n:"Current Clients",c:47},{icon:"🏆",n:"Gold Members",c:1},{icon:"🎂",n:"Birthdays This Month",c:3}].map(c=>(
          <div key={c.n} className="card" style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}><span style={{fontSize:22}}>{c.icon}</span><div style={{flex:1}}><p style={{fontSize:14,fontWeight:600}}>{c.n}</p><p style={{fontSize:12,color:C.muted}}>{c.c} contacts</p></div><input type="radio" name="aud" style={{accentColor:C.gold,width:18,height:18}}/></div>
        ))}
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,margin:"16px 0 12px"}}>{TMPLS.map(t=><span key={t.l} className="mtag" onClick={()=>setMsg(t.t)}>{t.l}</span>)}</div>
        <textarea className="txa" placeholder="Type your message..." value={msg} onChange={e=>setMsg(e.target.value)}/>
        <div style={{display:"flex",justifyContent:"space-between",margin:"4px 0 16px"}}><span style={{fontSize:11,color:C.muted}}>{msg.length}/160</span><span style={{fontSize:11,color:C.muted}}>47 recipients</span></div>
        {sent?<div style={{background:"rgba(76,175,122,.1)",border:"1px solid rgba(76,175,122,.3)",borderRadius:12,padding:14,textAlign:"center"}}><p style={{fontSize:16,fontWeight:700,color:C.green}}>✓ Sent to 47 Clients!</p></div>:<button className="btn bg" onClick={send} disabled={!msg}>📣 Send</button>}
      </div>}
      {tab==="new clients"&&<div className="sec"><div className="card"><p style={{fontSize:15,fontWeight:700,marginBottom:10}}>🔗 Booking Link</p><div style={{background:C.bg,borderRadius:10,padding:"11px 14px",fontFamily:"monospace",fontSize:13,color:C.gold,marginBottom:10}}>chopitup.app/marcus-barber</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><button className="bo" style={{fontSize:12,padding:"10px"}}>📋 Copy</button><button className="btn bg" style={{fontSize:12,padding:"10px"}}>📤 Share</button></div></div></div>}
      {tab==="social"&&<div className="sec"><div className="card"><p style={{fontSize:15,fontWeight:700,marginBottom:14}}>✨ AI Post Generator</p>{[{p:"Instagram",i:"📸",t:"Post best cut + booking link"},{p:"Facebook",i:"👍",t:"Open slots + promo"},{p:"TikTok",i:"🎵",t:"Transformation time-lapse script"}].map(s=><div key={s.p} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:22}}>{s.i}</span><div style={{flex:1}}><p style={{fontSize:13,fontWeight:600}}>{s.p}</p><p style={{fontSize:12,color:C.muted}}>{s.t}</p></div><button className="bgh" style={{fontSize:11,padding:"6px 10px"}}>Generate</button></div>)}</div></div>}
    </div>
  );
}

// ══════════════════════════════════════════
// PROFILE (v4 preserved)
// ══════════════════════════════════════════
function Profile({onAdmin,onBack,onSignOut,userData={shopName:"Fresh Cutz",barberName:"Marcus Johnson",role:"barber"}}){
  const [cfg,setCfg]=useState({sms:true,auto:true,nosh:false,online:true,tips:true,report:true});
  const [subOpen,setSubOpen]=useState(false);
  const [subTab,setSubTab]=useState("overview"); // overview | plans | payment | cancel | invoices
  const [selPlan,setSelPlan]=useState("pro");
  const [cancelStep,setCancelStep]=useState(1); // 1=warn 2=reason 3=confirm 4=done
  const [cancelReason,setCancelReason]=useState("");
  const [toast,setToast]=useState("");
  const [cardModal,setCardModal]=useState(false);
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const PLANS=[
    {id:"free",label:"Free",price:0,desc:"Basic scheduling only",color:C.muted,features:[
      {f:"Appointment booking",y:true},{f:"Client profiles (up to 50)",y:true},{f:"Basic payments",y:true},
      {f:"SMS reminders",y:false},{f:"Analytics & reports",y:false},{f:"Loyalty & gift cards",y:false},
      {f:"Multi-barber",y:false},{f:"AI forecasting",y:false},{f:"Priority support",y:false},
    ]},
    {id:"pro",label:"Pro",price:10,desc:"Everything you need to grow",color:C.gold,popular:false,features:[
      {f:"Appointment booking",y:true},{f:"Unlimited clients",y:true},{f:"Stripe payments",y:true},
      {f:"SMS reminders",y:true},{f:"Analytics & reports",y:true},{f:"Loyalty & gift cards",y:true},
      {f:"Multi-barber (up to 3)",y:true},{f:"AI forecasting",y:false},{f:"Priority support",y:false},
    ]},
    {id:"shop",label:"Shop",price:29,desc:"Full suite for busy shops",color:C.purple,popular:true,features:[
      {f:"Everything in Pro",y:true},{f:"Unlimited barbers",y:true},{f:"AI forecasting & goals",y:true},
      {f:"Payroll & commission",y:true},{f:"Tax & expense tracker",y:true},{f:"Multi-location",y:true},
      {f:"Priority support",y:true},{f:"Custom branding",y:true},{f:"Dedicated account manager",y:true},
    ]},
  ];

  const INVOICES=[
    {id:"INV-2026-02",date:"Feb 19, 2026",amount:10.00,status:"paid",plan:"Pro"},
    {id:"INV-2026-01",date:"Jan 19, 2026",amount:10.00,status:"paid",plan:"Pro"},
    {id:"INV-2025-12",date:"Dec 19, 2025",amount:10.00,status:"paid",plan:"Pro"},
    {id:"INV-2025-11",date:"Nov 19, 2025",amount:10.00,status:"paid",plan:"Pro"},
    {id:"INV-2025-10",date:"Oct 19, 2025",amount:10.00,status:"paid",plan:"Pro"},
  ];

  const CANCEL_REASONS=["Too expensive","Not using it enough","Missing a feature I need","Switching to another app","Taking a break from the business","Other"];

  const currentPlan=PLANS.find(p=>p.id==="pro");

  const handleUpgrade=()=>{
    if(selPlan==="pro"){showToast("Already on Pro!");return;}
    showToast(selPlan==="free"?"Downgraded to Free — active until Mar 19.":"Upgraded to Shop! 🎉");
    setSubOpen(false);
  };

  const handleCancelFinal=()=>{
    setCancelStep(4);
  };

  return(
    <div className="screen screen-enter">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:16}}>
        {onBack&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onBack}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Profile & Settings</h2>
          <div style={{width:60}}/>
        </div>}
        {!onBack&&<h2 className="pf" style={{fontSize:24,fontWeight:700}}>Profile</h2>}
      </div>
      <div className="sec">
        {/* Avatar card */}
        <div className="card" style={{textAlign:"center",padding:24,marginBottom:16}}>
          <div className="pav" style={{width:80,height:80,margin:"0 auto 12px",fontSize:32}}>{(userData.barberName||userData.shopName||"M")[0].toUpperCase()}</div>
          <h3 className="pf" style={{fontSize:22,fontWeight:700}}>{userData.barberName||userData.shopName||"Marcus Johnson"}</h3>
          <p style={{fontSize:13,color:C.muted,marginTop:2}}>{userData.shopName||"Fresh Cutz"}{userData.location?` · ${userData.location}`:""}</p>
          <div style={{display:"flex",justifyContent:"center",gap:24,marginTop:16}}>
            {[["247","clients"],["4.9⭐","rating"],["Gold","loyalty tier"]].map(([v,l])=>(
              <div key={l}><p style={{fontSize:18,fontWeight:700,color:l==="loyalty tier"?C.gold:C.text}}>{v}</p><p style={{fontSize:11,color:C.muted}}>{l}</p></div>
            ))}
          </div>
        </div>

        {/* PRO card — Manage now wired */}
        <div style={{background:"linear-gradient(135deg,rgba(201,168,76,.12),rgba(201,168,76,.04))",border:"1px solid rgba(201,168,76,.25)",borderRadius:14,padding:16,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{fontSize:12,color:C.gold,fontWeight:600}}>CHOP-IT-UP PRO</p>
            <p style={{fontSize:22,fontWeight:700}}><span className="pf">$10</span><span style={{fontSize:13,color:C.muted}}>/month</span></p>
            <p style={{fontSize:11,color:C.muted}}>Renews Mar 19, 2026</p>
          </div>
          <div style={{textAlign:"right"}}>
            <span className="badge bgrn" style={{marginBottom:8,display:"block"}}>Active</span>
            <button className="bgh" style={{fontSize:11,padding:"6px 12px"}} onClick={()=>{setSubOpen(true);setSubTab("overview");setCancelStep(1);}}>Manage</button>
          </div>
        </div>

        <p className="stit">Settings</p>
        <div className="card" style={{marginBottom:16}}>
          {[["sms","SMS Reminders","24hr auto-send"],["auto","Auto-Confirm","Skip approval"],["nosh","No-Show Fee","50% charge"],["online","Online Booking","Via link"],["tips","Tips in Checkout","Show tip screen"],["report","Weekly Report","Email summary"]].map(([k,l,s])=>(
            <div key={k} className="trow"><div><p style={{fontSize:14,fontWeight:600}}>{l}</p><p style={{fontSize:12,color:C.muted}}>{s}</p></div><Tog on={cfg[k]} toggle={()=>setCfg(c=>({...c,[k]:!c[k]}))}/></div>
          ))}
        </div>
        <button onClick={()=>{if(onSignOut)onSignOut();}} style={{width:"100%",marginBottom:8,borderRadius:12,padding:"13px",background:"transparent",border:"1px solid rgba(224,82,82,.3)",color:C.red,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600}}>Sign Out</button>
        <p style={{fontSize:11,color:C.dim,textAlign:"center",marginBottom:20}}>Chop-It-Up v11.0 · Terms · Privacy</p>
      </div>

      {/* ── SUBSCRIPTION MANAGEMENT SHEET ── */}
      {subOpen&&(
        <div className="sub-modal" onClick={()=>setSubOpen(false)}>
          <div className="sub-sheet" onClick={e=>e.stopPropagation()}>
            <div className="mh" style={{margin:"12px auto 0"}}/>

            {/* Sheet header */}
            <div style={{padding:"16px 20px 0",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <h3 className="pf" style={{fontSize:20,fontWeight:700}}>Subscription</h3>
              <button onClick={()=>setSubOpen(false)} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer",padding:4,lineHeight:1}}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{padding:"0 20px"}}>
              <div className="ptabs" style={{marginBottom:0}}>
                {[{id:"overview",l:"Overview"},{id:"plans",l:"Plans"},{id:"payment",l:"Payment"},{id:"invoices",l:"Invoices"},{id:"cancel",l:"Cancel"}].map(t=>(
                  <div key={t.id} className={`ptab${subTab===t.id?" act":""}`} onClick={()=>{setSubTab(t.id);if(t.id==="cancel")setCancelStep(1);}} style={{fontSize:11,color:t.id==="cancel"&&subTab!=="cancel"?C.red:undefined}}>{t.l}</div>
                ))}
              </div>
            </div>

            <div style={{padding:"20px 20px 0"}}>

              {/* ── OVERVIEW TAB ── */}
              {subTab==="overview"&&<>
                {/* Current plan hero */}
                <div style={{background:"linear-gradient(135deg,rgba(201,168,76,.18),rgba(201,168,76,.06))",border:"1px solid rgba(201,168,76,.35)",borderRadius:18,padding:20,marginBottom:16,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",right:14,top:14,fontSize:48,opacity:.1}}>👑</div>
                  <div style={{fontSize:11,color:C.gold,fontWeight:700,letterSpacing:.5,marginBottom:4}}>CURRENT PLAN</div>
                  <div style={{fontSize:28,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.gold,marginBottom:2}}>Pro</div>
                  <div style={{fontSize:20,fontWeight:800,marginBottom:8}}>$10<span style={{fontSize:13,color:C.muted,fontWeight:400}}>/month</span></div>
                  <div style={{display:"flex",gap:16}}>
                    <div><div style={{fontSize:13,fontWeight:700,color:C.green}}>Active</div><div style={{fontSize:10,color:C.muted}}>Status</div></div>
                    <div><div style={{fontSize:13,fontWeight:700}}>Mar 19, 2026</div><div style={{fontSize:10,color:C.muted}}>Next billing</div></div>
                    <div><div style={{fontSize:13,fontWeight:700}}>5 months</div><div style={{fontSize:10,color:C.muted}}>Member since</div></div>
                  </div>
                </div>

                {/* What's included */}
                <p className="stit">What's included</p>
                <div className="card" style={{marginBottom:16}}>
                  {currentPlan.features.filter(f=>f.y).map(f=>(
                    <div key={f.f} className="feature-row">
                      <div className="check yes">✓</div>
                      <span style={{fontSize:13}}>{f.f}</span>
                    </div>
                  ))}
                </div>

                {/* Upgrade nudge */}
                <div style={{background:"linear-gradient(135deg,rgba(167,139,250,.12),rgba(167,139,250,.04))",border:"1px solid rgba(167,139,250,.3)",borderRadius:14,padding:14,marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{fontSize:28}}>🚀</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.purple}}>Upgrade to Shop</div>
                    <div style={{fontSize:11,color:C.muted}}>Unlock AI forecasting, payroll, unlimited barbers & more for $29/mo.</div>
                  </div>
                  <button className="bgh" style={{fontSize:11,padding:"8px 12px",flexShrink:0,borderColor:"rgba(167,139,250,.4)",color:C.purple}} onClick={()=>setSubTab("plans")}>See Plans →</button>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:4}}>
                  <button className="bo" style={{padding:"12px",fontSize:13}} onClick={()=>setSubTab("payment")}>💳 Payment Method</button>
                  <button className="bo" style={{padding:"12px",fontSize:13}} onClick={()=>setSubTab("invoices")}>🧾 View Invoices</button>
                </div>
              </>}

              {/* ── PLANS TAB ── */}
              {subTab==="plans"&&<>
                <p className="stit" style={{marginTop:0}}>Choose a Plan</p>
                {PLANS.map(plan=>(
                  <div key={plan.id} className={`plan-card${selPlan===plan.id?" current":plan.id==="shop"?" highlight":""}`} style={{marginBottom:12}} onClick={()=>setSelPlan(plan.id)}>
                    {plan.popular&&<div style={{position:"absolute",top:0,right:0,background:C.purple,color:"white",fontSize:9,fontWeight:800,padding:"5px 12px",borderRadius:"0 16px 0 10px",letterSpacing:.5}}>BEST VALUE</div>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:16,fontWeight:800,color:plan.color}}>{plan.label}</div>
                        <div style={{fontSize:11,color:C.muted}}>{plan.desc}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:20,fontWeight:900,fontFamily:"'Playfair Display',serif"}}>{plan.price===0?"Free":"$"+plan.price}<span style={{fontSize:11,color:C.muted,fontWeight:400}}>{plan.price>0?"/mo":""}</span></div>
                        {selPlan===plan.id&&plan.id==="pro"&&<div style={{fontSize:10,color:C.green,fontWeight:700}}>✓ Current plan</div>}
                      </div>
                    </div>
                    {plan.features.map(f=>(
                      <div key={f.f} className="feature-row" style={{padding:"4px 0"}}>
                        <div className={`check ${f.y?"yes":"no"}`}>{f.y?"✓":"—"}</div>
                        <span style={{fontSize:12,color:f.y?C.text:C.dim}}>{f.f}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <button className="btn bg" style={{width:"100%",marginBottom:8}} onClick={handleUpgrade}>
                  {selPlan==="pro"?"✓ Keep Current Plan":selPlan==="shop"?"Upgrade to Shop — $29/mo":"Downgrade to Free"}
                </button>
                {selPlan==="free"&&<p style={{fontSize:11,color:C.orange,textAlign:"center"}}>⚠️ You'll lose access to SMS, analytics, loyalty rewards, and more on Mar 19.</p>}
              </>}

              {/* ── PAYMENT TAB ── */}
              {subTab==="payment"&&<>
                <p className="stit" style={{marginTop:0}}>Payment Method</p>
                <div className="payment-method-card sel" style={{marginBottom:16}}>
                  <div style={{width:44,height:28,background:"linear-gradient(135deg,#1a1f71,#2563eb)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💳</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700}}>Visa ending in 4821</div>
                    <div style={{fontSize:12,color:C.muted}}>Expires 09/2027</div>
                  </div>
                  <span style={{color:C.green,fontSize:18}}>✓</span>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                  <button className="bo" style={{padding:"12px",fontSize:13}} onClick={()=>setCardModal(true)}>✏️ Update Card</button>
                  <button className="bo" style={{padding:"12px",fontSize:13}} onClick={()=>showToast("Apple Pay linked!")}>Apple Pay</button>
                </div>

                <p className="stit">Billing Address</p>
                <div className="card" style={{marginBottom:16}}>
                  {[["Name","Marcus Johnson"],["Address","1420 Magazine St"],["City / State","New Orleans, LA 70130"],["Country","United States"]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                      <span style={{fontSize:12,color:C.muted}}>{l}</span>
                      <span style={{fontSize:13,fontWeight:600}}>{v}</span>
                    </div>
                  ))}
                </div>
                <button className="btn bg" style={{width:"100%"}} onClick={()=>showToast("Billing address updated!")}>Save Changes</button>

                {/* Inline card update modal */}
                {cardModal&&(
                  <div className="ov" onClick={()=>setCardModal(false)}>
                    <div className="mod" onClick={e=>e.stopPropagation()}>
                      <div className="mh"/>
                      <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:16}}>Update Card</h3>
                      <div style={{marginBottom:12}}><label className="lbl">Card Number</label><input className="inp" placeholder="•••• •••• •••• ••••" maxLength={19}/></div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                        <div><label className="lbl">Expiry</label><input className="inp" placeholder="MM / YY" maxLength={7}/></div>
                        <div><label className="lbl">CVV</label><input className="inp" placeholder="•••" maxLength={4} type="password"/></div>
                      </div>
                      <div style={{marginBottom:16}}><label className="lbl">Name on Card</label><input className="inp" placeholder="Marcus Johnson"/></div>
                      <div style={{background:"rgba(76,175,122,.08)",border:"1px solid rgba(76,175,122,.2)",borderRadius:10,padding:"10px 12px",marginBottom:14,display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:16}}>🔒</span>
                        <span style={{fontSize:11,color:C.muted}}>Card details are encrypted and processed securely via Stripe. Chop-It-Up never stores raw card data.</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <button className="bo" style={{padding:"12px"}} onClick={()=>setCardModal(false)}>Cancel</button>
                        <button className="btn bg" onClick={()=>{showToast("Card updated!");setCardModal(false);}}>Save Card</button>
                      </div>
                    </div>
                  </div>
                )}
              </>}

              {/* ── INVOICES TAB ── */}
              {subTab==="invoices"&&<>
                <p className="stit" style={{marginTop:0}}>Billing History</p>
                <div style={{background:"rgba(76,175,122,.07)",border:"1px solid rgba(76,175,122,.2)",borderRadius:12,padding:"10px 14px",marginBottom:14,display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:18}}>✅</span>
                  <div><div style={{fontSize:13,fontWeight:700,color:C.green}}>All payments up to date</div><div style={{fontSize:11,color:C.muted}}>5 invoices · $50.00 total billed</div></div>
                </div>
                {INVOICES.map(inv=>(
                  <div key={inv.id} className="invoice-row">
                    <div>
                      <div style={{fontSize:14,fontWeight:700}}>{inv.date}</div>
                      <div style={{fontSize:11,color:C.muted}}>{inv.id} · {inv.plan} Plan</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <span className="badge bgrn" style={{fontSize:9}}>Paid</span>
                      <span style={{fontSize:15,fontWeight:800}}>${inv.amount.toFixed(2)}</span>
                      <button className="bgh" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>showToast("Invoice downloaded!")}>↓ PDF</button>
                    </div>
                  </div>
                ))}
                <button className="bo" style={{width:"100%",marginTop:16,padding:"12px",fontSize:13}} onClick={()=>showToast("Full history exported!")}>Export All as CSV</button>
              </>}

              {/* ── CANCEL TAB ── */}
              {subTab==="cancel"&&<>
                {cancelStep===1&&(
                  <div className="cancel-step">
                    <div style={{fontSize:60,marginBottom:16}}>😢</div>
                    <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:8}}>Cancel your subscription?</h3>
                    <p style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:20}}>If you cancel, you'll keep access to Pro features until <strong style={{color:C.text}}>Mar 19, 2026</strong>. After that, your account drops to Free.</p>
                    <div style={{width:"100%",marginBottom:12}}>
                      <p className="stit" style={{textAlign:"left"}}>You'll lose access to:</p>
                      {["SMS appointment reminders","Analytics & growth reports","Loyalty rewards & gift cards","Multi-barber management","Online booking link","Stripe payment integration"].map(f=>(
                        <div key={f} className="feature-row">
                          <div className="check" style={{background:"rgba(224,82,82,.12)",color:C.red}}>✕</div>
                          <span style={{fontSize:13,color:C.muted}}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,width:"100%",marginTop:8}}>
                      <button className="bo" style={{padding:"13px"}} onClick={()=>setSubTab("overview")}>Keep Pro ✓</button>
                      <button style={{padding:"13px",borderRadius:12,border:`1px solid rgba(224,82,82,.35)`,background:"transparent",color:C.red,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600}} onClick={()=>setCancelStep(2)}>Continue →</button>
                    </div>
                  </div>
                )}

                {cancelStep===2&&(
                  <div>
                    <h3 className="pf" style={{fontSize:18,fontWeight:700,marginBottom:4}}>Why are you leaving?</h3>
                    <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Your feedback helps us improve Chop-It-Up.</p>
                    {CANCEL_REASONS.map(r=>(
                      <div key={r} onClick={()=>setCancelReason(r)} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderRadius:12,border:`1px solid ${cancelReason===r?C.red:C.border}`,background:cancelReason===r?"rgba(224,82,82,.06)":C.card,marginBottom:8,cursor:"pointer",transition:"all .18s"}}>
                        <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${cancelReason===r?C.red:C.border}`,background:cancelReason===r?C.red:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {cancelReason===r&&<div style={{width:6,height:6,borderRadius:"50%",background:"white"}}/>}
                        </div>
                        <span style={{fontSize:13,fontWeight:cancelReason===r?700:400}}>{r}</span>
                      </div>
                    ))}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
                      <button className="bo" style={{padding:"12px"}} onClick={()=>setCancelStep(1)}>← Back</button>
                      <button style={{padding:"12px",borderRadius:12,border:`1px solid rgba(224,82,82,.35)`,background:"transparent",color:C.red,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600,opacity:cancelReason?1:.4}} disabled={!cancelReason} onClick={()=>setCancelStep(3)}>Next →</button>
                    </div>
                  </div>
                )}

                {cancelStep===3&&(
                  <div className="cancel-step">
                    <div style={{fontSize:52,marginBottom:12}}>⚠️</div>
                    <h3 className="pf" style={{fontSize:18,fontWeight:700,marginBottom:8}}>Last chance</h3>
                    <p style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:12}}>Before you go — would a discount help? We can offer you <strong style={{color:C.gold}}>50% off for the next 2 months</strong> ($5/mo).</p>
                    <button className="btn bg" style={{width:"100%",marginBottom:10}} onClick={()=>{showToast("Discount applied! Staying on Pro at $5/mo 🎉");setSubOpen(false);}}>
                      Yes, apply 50% off 🎉
                    </button>
                    <button style={{width:"100%",padding:"12px",borderRadius:12,border:`1px solid rgba(224,82,82,.3)`,background:"transparent",color:C.red,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600}} onClick={handleCancelFinal}>
                      No thanks, cancel anyway
                    </button>
                    <button className="bo" style={{width:"100%",marginTop:8,padding:"11px",fontSize:12}} onClick={()=>setCancelStep(2)}>← Back</button>
                  </div>
                )}

                {cancelStep===4&&(
                  <div className="cancel-step">
                    <div style={{fontSize:60,marginBottom:12}}>👋</div>
                    <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:8}}>You're all set</h3>
                    <p style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:20}}>Your Pro subscription has been cancelled. You'll keep full access until <strong style={{color:C.text}}>Mar 19, 2026</strong>, then switch to Free.</p>
                    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,width:"100%",marginBottom:16}}>
                      {[["Plan after Mar 19","Free"],["Data retained","Yes, always"],["Reactivate anytime","Yes"],["Feedback reason",cancelReason]].map(([l,v])=>(
                        <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                          <span style={{fontSize:12,color:C.muted}}>{l}</span>
                          <span style={{fontSize:12,fontWeight:700}}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <button className="btn bg" style={{width:"100%"}} onClick={()=>setSubOpen(false)}>Close</button>
                  </div>
                )}
              </>}

            </div>{/* end padding wrapper */}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// ADD APPT MODAL
// ══════════════════════════════════════════
function AddAppt({onClose}){
  const [step,setStep]=useState(1);
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [svc,setSvc]=useState("Haircut");
  const [slot,setSlot]=useState(null);
  const [recurring,setRecurring]=useState("none");
  const RECUR=[{id:"none",label:"One-time",icon:"1️⃣"},{id:"Weekly",label:"Weekly",icon:"📅"},{id:"Biweekly",label:"Every 2 Wks",icon:"🔄"},{id:"Monthly",label:"Monthly",icon:"📆"}];
  return(
    <div className="ov" onClick={onClose}>
      <div className="mod" onClick={e=>e.stopPropagation()}>
        <div className="mh"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 className="pf" style={{fontSize:22,fontWeight:700}}>{step===1?"Client Info":step===2?"Pick a Time":"Recurring?"}</h3>
          <div style={{display:"flex",gap:5}}>{[1,2,3].map(n=><div key={n} style={{width:8,height:8,borderRadius:"50%",background:step===n?C.gold:C.border}}/>)}</div>
        </div>
        {step===1&&<>
          <div style={{marginBottom:12}}><label className="lbl">Name</label><input className="inp" placeholder="First Last" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div style={{marginBottom:12}}><label className="lbl">Phone</label><input className="inp" placeholder="(555) 000-0000" type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
          <div style={{marginBottom:20}}><label className="lbl">Service</label><select className="sel" value={svc} onChange={e=>setSvc(e.target.value)}>{SVCS.map(s=><option key={s.name}>{s.name}</option>)}</select></div>
          <button className="btn bg" onClick={()=>setStep(2)} disabled={!name}>Next →</button>
        </>}
        {step===2&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
            {ALL_SLOTS.map(s=><div key={s} className={`tslot${slot===s?" sel":""}${TAKEN_SLOTS.includes(s)?" taken":""}`} onClick={()=>!TAKEN_SLOTS.includes(s)&&setSlot(s)}>{s}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button className="bo" onClick={()=>setStep(1)}>← Back</button>
            <button className="btn bg" disabled={!slot} onClick={()=>setStep(3)}>Next →</button>
          </div>
        </>}
        {step===3&&<>
          <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Schedule {name} on a regular cadence?</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {RECUR.map(r=><div key={r.id} onClick={()=>setRecurring(r.id)} style={{background:recurring===r.id?"rgba(201,168,76,.1)":C.card,border:`1px solid ${recurring===r.id?C.gold:C.border}`,borderRadius:12,padding:14,textAlign:"center",cursor:"pointer",transition:"all .2s"}}><div style={{fontSize:22,marginBottom:6}}>{r.icon}</div><p style={{fontSize:13,fontWeight:600,color:recurring===r.id?C.gold:C.text}}>{r.label}</p></div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button className="bo" onClick={()=>setStep(2)}>← Back</button>
            <button className="btn bg" onClick={async()=>{
              const price=SVCS.find(s=>s.name===svc)?.price||0;
              try{
                await ParseService.addAppointment({
                  name, phone, service:svc, time:slot,
                  price, recurring:recurring==="none"?null:recurring,
                  dateStr:new Date().toLocaleDateString(),
                });
              }catch(e){}
              onClose();
            }}>✓ Book {slot}</button>
          </div>
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// CALENDAR / SCHEDULE VIEW
// ══════════════════════════════════════════
function CalendarScreen({onClose}){
  const [weekOffset,setWeekOffset]=useState(0);
  const [selBarber,setSelBarber]=useState("All");
  const [selEvent,setSelEvent]=useState(null);
  const [dragHint,setDragHint]=useState(true);
  const BARBERS=["All","Marcus","Darius","Jerome"];
  const BARBER_COLORS={Marcus:C.gold,Darius:C.blue,Jerome:C.green};
  const CELL_H=48; // px per hour

  // Build week dates
  const baseDate=new Date(2026,1,16); // Mon Feb 16
  baseDate.setDate(baseDate.getDate()+weekOffset*7);
  const weekDates=Array.from({length:7},(_,i)=>{
    const d=new Date(baseDate);
    d.setDate(baseDate.getDate()+i);
    return {label:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i],date:d.getDate(),isToday:i===3&&weekOffset===0};
  });

  const filtered=selBarber==="All"?CAL_APPTS:CAL_APPTS.filter(a=>a.barber===selBarber);
  const dayAppts=day=>filtered.filter(a=>a.day===day);

  function EventBlock({appt}){
    const top=(appt.startH-8)*CELL_H+(appt.startM/60)*CELL_H;
    const height=Math.max((appt.dur/60)*CELL_H,24);
    const bc=BARBER_COLORS[appt.barber]||C.gold;
    return(
      <div className="cal-event" style={{top,height,left:2,right:2,background:`${bc}18`,borderLeftColor:bc,color:bc}} onClick={()=>setSelEvent(appt)}>
        <div style={{fontSize:10,fontWeight:700,lineHeight:1.2,color:bc}}>{appt.client}</div>
        {height>32&&<div style={{fontSize:9,opacity:.8,marginTop:1,color:C.text}}>{appt.service}</div>}
        {height>48&&<div style={{fontSize:9,opacity:.7,color:C.text}}>{appt.startH%12||12}:{String(appt.startM).padStart(2,"0")}{appt.startH>=12?"PM":"AM"}</div>}
      </div>
    );
  }

  return(
    <div className="modfull">
      {/* Header */}
      <div style={{padding:"16px 20px 0",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Schedule</h2>
          <button className="bgh" style={{fontSize:12}}>+ Add</button>
        </div>
        {/* Barber filter tabs */}
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:10,scrollbarWidth:"none"}}>
          {BARBERS.map(b=>(
            <div key={b} className={`cal-barber-tab${selBarber===b?" sel":""}`} onClick={()=>setSelBarber(b)}>
              {b!=="All"&&<span style={{width:8,height:8,borderRadius:"50%",background:BARBER_COLORS[b],display:"inline-block",marginRight:6}}/>}
              {b}
            </div>
          ))}
        </div>
        {/* Week navigation */}
        <div className="cal-week-nav" style={{padding:"0 0 8px"}}>
          <div className="cal-week-btn" onClick={()=>setWeekOffset(w=>w-1)}>‹</div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:700}}>Feb {weekDates[0].date}–{weekDates[6].date}, 2026</div>
            {weekOffset===0&&<div style={{fontSize:10,color:C.gold,fontWeight:600}}>THIS WEEK</div>}
          </div>
          <div className="cal-week-btn" onClick={()=>setWeekOffset(w=>w+1)}>›</div>
        </div>
        {dragHint&&<div className="swipe-hint" style={{marginBottom:8}}>✋ Tap an event to view details &nbsp;·&nbsp; Scroll to navigate time <span onClick={()=>setDragHint(false)} style={{color:C.gold,cursor:"pointer"}}>✕</span></div>}
      </div>

      {/* Calendar grid */}
      <div style={{display:"flex",height:"calc(100vh - 200px)",overflow:"hidden"}}>
        {/* Time labels */}
        <div className="cal-time-col" style={{paddingTop:36}}>
          {CAL_HOURS.map(h=><div key={h} className="cal-time-label">{h}</div>)}
        </div>
        {/* Day columns */}
        <div style={{flex:1,overflow:"auto",position:"relative"}}>
          {/* Day headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",position:"sticky",top:0,zIndex:10,background:C.bg,borderBottom:`1px solid ${C.border}`}}>
            {weekDates.map((d,i)=>(
              <div key={i} className={`cal-col-hdr${d.isToday?" today":""}`}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:.5}}>{d.label}</div>
                <div style={{fontSize:16,fontWeight:700,lineHeight:1.2,color:d.isToday?C.gold:C.text}}>{d.date}</div>
                {d.isToday&&<div style={{width:4,height:4,borderRadius:"50%",background:C.gold,margin:"2px auto 0"}}/>}
              </div>
            ))}
          </div>
          {/* Grid */}
          <div className="cal-day-cols" style={{gridTemplateColumns:"repeat(7,1fr)",display:"grid",height:CAL_HOURS.length*CELL_H}}>
            {weekDates.map((_,dayIdx)=>(
              <div key={dayIdx} className="cal-day-col" style={{position:"relative",height:CAL_HOURS.length*CELL_H}}>
                {/* Hour lines */}
                {CAL_HOURS.map((_,hi)=><div key={hi} className="cal-row-line hour" style={{top:hi*CELL_H}}/>)}
                {/* Half-hour lines */}
                {CAL_HOURS.map((_,hi)=><div key={`h${hi}`} className="cal-row-line" style={{top:hi*CELL_H+CELL_H/2}}/>)}
                {/* Now line on today */}
                {dayIdx===3&&weekOffset===0&&<div className="cal-now-line" style={{top:CELL_H*(10-8+0.25)}}/>}
                {/* Events */}
                {dayAppts(dayIdx).map(appt=><EventBlock key={appt.id} appt={appt}/>)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event detail modal */}
      {selEvent&&(
        <div className="ov" onClick={()=>setSelEvent(null)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <div className="mh"/>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <div style={{width:48,height:48,borderRadius:14,background:`${BARBER_COLORS[selEvent.barber]||C.gold}20`,border:`1px solid ${BARBER_COLORS[selEvent.barber]||C.gold}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>✂️</div>
              <div>
                <div style={{fontSize:17,fontWeight:700}}>{selEvent.client}</div>
                <div style={{fontSize:13,color:C.muted}}>{selEvent.service}</div>
              </div>
              <div style={{marginLeft:"auto",textAlign:"right"}}>
                <span className="badge bgold">{selEvent.barber}</span>
              </div>
            </div>
            {[
              ["📅","Day",["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][selEvent.day]+", Feb "+(16+selEvent.day)],
              ["🕐","Time",`${selEvent.startH%12||12}:${String(selEvent.startM).padStart(2,"0")} ${selEvent.startH>=12?"PM":"AM"}`],
              ["⏱","Duration",`${selEvent.dur} min`],
            ].map(([ic,lb,vl])=>(
              <div key={lb} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:18,width:28}}>{ic}</span>
                <span style={{fontSize:13,color:C.muted,width:70}}>{lb}</span>
                <span style={{fontSize:14,fontWeight:600}}>{vl}</span>
              </div>
            ))}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:16}}>
              <button className="bo" style={{padding:"11px",fontSize:13}} onClick={()=>setSelEvent(null)}>✏️ Reschedule</button>
              <button className="btn bg" style={{fontSize:13}} onClick={()=>setSelEvent(null)}>✓ Check In</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// REVIEW & RATING SYSTEM
// ══════════════════════════════════════════
function ReviewsScreen({onClose}){
  const [reviews,setReviews]=useState(REVIEWS_INIT);
  const [activeTab,setActiveTab]=useState("all"); // all | pending | responded
  const [replyTarget,setReplyTarget]=useState(null);
  const [replyText,setReplyText]=useState("");
  const [reqModal,setReqModal]=useState(false);
  const [reqClient,setReqClient]=useState(null);
  const [toast,setToast]=useState("");

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500)};

  const avg=reviews.reduce((a,r)=>a+r.rating,0)/reviews.length;
  const dist=[5,4,3,2,1].map(s=>({s,count:reviews.filter(r=>r.rating===s).length}));
  const tabs=[
    {id:"all",label:"All",count:reviews.length},
    {id:"pending",label:"Unreplied",count:reviews.filter(r=>!r.reply).length},
    {id:"responded",label:"Replied",count:reviews.filter(r=>r.reply).length},
  ];
  const filtered=reviews.filter(r=>activeTab==="pending"?!r.reply:activeTab==="responded"?!!r.reply:true);

  const sendReply=()=>{
    if(!replyText.trim())return;
    setReviews(r=>r.map(rv=>rv.id===replyTarget.id?{...rv,reply:replyText,repliedAt:"Just now"}:rv));
    showToast("Reply posted!");
    setReplyTarget(null);setReplyText("");
  };

  const sendReviewReq=()=>{
    showToast(`Review request sent to ${reqClient.name}`);
    setReqModal(false);setReqClient(null);
  };

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      {/* Header */}
      <div className="hdr" style={{paddingBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Reviews</h2>
          <button className="bgh" onClick={()=>setReqModal(true)}>Request</button>
        </div>

        {/* Rating summary card */}
        <div style={{background:`${C.card}`,border:`1px solid ${C.border}`,borderRadius:18,padding:20,marginBottom:4}}>
          <div style={{display:"flex",gap:20,alignItems:"center"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:48,fontWeight:800,fontFamily:"'Playfair Display',serif",color:C.gold,lineHeight:1}}>{avg.toFixed(1)}</div>
              <Stars count={Math.round(avg)} size={16}/>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{reviews.length} reviews</div>
            </div>
            <div style={{flex:1}}>
              {dist.map(({s,count})=>(
                <div key={s} className="rating-bar-row">
                  <span style={{fontSize:11,color:C.muted,width:12}}>{s}</span>
                  <span style={{fontSize:10}}>⭐</span>
                  <div className="rating-bar-bg">
                    <div className="rating-bar-fill" style={{width:`${reviews.length?count/reviews.length*100:0}%`}}/>
                  </div>
                  <span style={{fontSize:11,color:C.muted,width:18,textAlign:"right"}}>{count}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Platform breakdown */}
          <div style={{borderTop:`1px solid ${C.border}`,marginTop:14,paddingTop:14,display:"flex",gap:20}}>
            {[{p:"Google",icon:"🌐"},{p:"Yelp",icon:"⭐"}].map(({p,icon})=>{
              const pr=reviews.filter(r=>r.platform===p);
              const pavg=pr.length?pr.reduce((a,r)=>a+r.rating,0)/pr.length:0;
              return(
                <div key={p} className="platform-star" style={{border:"none",gap:10,padding:0}}>
                  <span style={{fontSize:18}}>{icon}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700}}>{p}</div>
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      <Stars count={Math.round(pavg)} size={11}/>
                      <span style={{fontSize:11,color:C.muted}}>{pavg.toFixed(1)} ({pr.length})</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sec" style={{paddingBottom:100}}>
        {/* Tabs */}
        <div className="ptabs" style={{marginBottom:16}}>
          {tabs.map(t=>(
            <div key={t.id} className={`ptab${activeTab===t.id?" act":""}`} onClick={()=>setActiveTab(t.id)}>
              {t.label} {t.count>0&&<span style={{background:activeTab===t.id?`${C.gold}30`:`${C.border}`,borderRadius:10,padding:"1px 6px",fontSize:10,marginLeft:4}}>{t.count}</span>}
            </div>
          ))}
        </div>

        {/* Request Review Banner */}
        {activeTab==="pending"&&filtered.length===0&&(
          <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
            <div style={{fontSize:40,marginBottom:12}}>🎉</div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>All reviews replied!</div>
            <div style={{fontSize:13}}>Great work keeping up with your clients.</div>
          </div>
        )}

        {/* Review list */}
        {filtered.map(rev=>(
          <div key={rev.id} className="review-card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div className="pav" style={{width:38,height:38,fontSize:16,background:`linear-gradient(135deg,${rev.color},${rev.color}88)`}}>{rev.avatar}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700}}>{rev.name}</div>
                  <div style={{fontSize:11,color:C.muted}}>{rev.service} · {rev.date}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <Stars count={rev.rating} size={12}/>
                <span style={{fontSize:10,color:C.muted}}>{rev.platform}</span>
              </div>
            </div>
            <p style={{fontSize:13,lineHeight:1.6,color:C.text,marginBottom:10}}>"{rev.body}"</p>
            {rev.reply&&(
              <div className="reply-bubble">
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:11,color:C.gold,fontWeight:700}}>✂️ Your reply</span>
                  <span style={{fontSize:10,color:C.dim}}>· {rev.repliedAt}</span>
                </div>
                <p style={{fontSize:12,lineHeight:1.5,color:C.muted}}>{rev.reply}</p>
              </div>
            )}
            {!rev.reply&&(
              <button className="bgh" style={{width:"100%",padding:"9px",fontSize:12,textAlign:"center"}} onClick={()=>{setReplyTarget(rev);setReplyText("");}}>
                💬 Reply to review
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Reply modal */}
      {replyTarget&&(
        <div className="ov" onClick={()=>setReplyTarget(null)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <div className="mh"/>
            <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:4}}>Reply to Review</h3>
            <p style={{fontSize:12,color:C.muted,marginBottom:14}}>Replying to {replyTarget.name} · {replyTarget.platform}</p>
            <div style={{background:C.bg,borderRadius:12,padding:12,marginBottom:14,borderLeft:`3px solid ${C.gold}`}}>
              <p style={{fontSize:13,color:C.muted,fontStyle:"italic"}}>"{replyTarget.body}"</p>
            </div>
            <label className="lbl">Your reply</label>
            <textarea className="txa" rows={4} placeholder="Thank you for your review..." value={replyText} onChange={e=>setReplyText(e.target.value)} style={{marginBottom:16}}/>
            <div style={{display:"flex",gap:10}}>
              <button className="bo" style={{flex:1,padding:"12px"}} onClick={()=>setReplyTarget(null)}>Cancel</button>
              <button className="btn bg" style={{flex:2}} onClick={sendReply} disabled={!replyText.trim()}>Post Reply</button>
            </div>
          </div>
        </div>
      )}

      {/* Request review modal */}
      {reqModal&&(
        <div className="ov" onClick={()=>setReqModal(false)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <div className="mh"/>
            <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:4}}>Request a Review</h3>
            <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Send a text to a recent client asking for a review.</p>
            <label className="lbl">Select client</label>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {CLIENTS.filter(c=>c.lastVisit).slice(0,4).map(c=>(
                <div key={c.id} onClick={()=>setReqClient(c)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:reqClient?.id===c.id?`${C.gold}10`:C.card,border:`1px solid ${reqClient?.id===c.id?C.gold:C.border}`,borderRadius:12,cursor:"pointer",transition:"all .18s"}}>
                  <div className="pav" style={{width:36,height:36,fontSize:14,background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`}}>{c.avatar}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{c.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>Last visit: {c.lastVisit}</div>
                  </div>
                  {reqClient?.id===c.id&&<span style={{color:C.gold,fontSize:18}}>✓</span>}
                </div>
              ))}
            </div>
            <div style={{background:C.bg,borderRadius:12,padding:14,marginBottom:16,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,color:C.gold,fontWeight:700,marginBottom:6}}>📱 SMS PREVIEW</div>
              <p style={{fontSize:13,lineHeight:1.6,color:C.text}}>Hey {reqClient?.name?.split(" ")[0]||"[Name]"}! Thanks for coming in. If you have a minute, we'd love a Google review: g.co/chopitup 🌟 It means a lot to us!</p>
            </div>
            <button className="btn bg" onClick={sendReviewReq} disabled={!reqClient}>Send Review Request 📲</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// STRIPE PAYMENT INTEGRATION UI
// ══════════════════════════════════════════
function StripePaymentsScreen({onClose}){
  const [tab,setTab]=useState("overview"); // overview | readers | payouts | bank
  const [readers,setReaders]=useState(STRIPE_READERS);
  const [pairingMode,setPairingMode]=useState(false);
  const [bankLinked,setBankLinked]=useState(true);
  const [toast,setToast]=useState("");
  const [confirmUnlink,setConfirmUnlink]=useState(false);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500)};

  const connectReader=()=>{
    setPairingMode(true);
    setTimeout(()=>{
      setReaders(r=>r.map(rd=>rd.id===2?{...rd,status:"connected",battery:54,lastUsed:"Just now"}:rd));
      setPairingMode(false);
      showToast("Stripe Reader M2 connected!");
    },2500);
  };

  const totalVolume=STRIPE_PAYOUTS.reduce((a,p)=>a+p.amount,0);
  const stripeRate=0.027;
  const stripeFees=totalVolume*stripeRate;

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      {/* Header */}
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Stripe Payments</h2>
          <div style={{width:60}}/>
        </div>
        {/* Tab bar */}
        <div className="ptabs" style={{marginBottom:0}}>
          {[{id:"overview",label:"Overview"},{id:"readers",label:"Readers"},{id:"payouts",label:"Payouts"},{id:"bank",label:"Bank"}].map(t=>(
            <div key={t.id} className={`ptab${tab===t.id?" act":""}`} onClick={()=>setTab(t.id)} style={{fontSize:12}}>{t.label}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:60}}>

        {/* OVERVIEW TAB */}
        {tab==="overview"&&<>
          {/* Stripe hero */}
          <div className="stripe-hero">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#635BFF,#7B73FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>💳</div>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:"#635BFF"}}>Stripe</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}`}}/><span style={{fontSize:12,color:C.green,fontWeight:600}}>Connected & Active</span></div>
              </div>
              <span style={{marginLeft:"auto",fontSize:11,color:C.muted}}>marcus@chopitup.com</span>
            </div>
            <div style={{display:"flex",gap:12}}>
              {[{label:"This Month",val:"$2,847"},{label:"Avg. Fee",val:"2.7%"},{label:"Next Payout",val:"Feb 19"}].map(({label,val})=>(
                <div key={label} className="stripe-stat">
                  <div style={{fontSize:16,fontWeight:800,color:C.text}}>{val}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Processing rates */}
          <p className="stit">Processing Rates</p>
          <div className="card" style={{marginBottom:16}}>
            {[
              {type:"Card Present (Reader)",rate:"2.7% + 0¢",icon:"💳",highlight:true},
              {type:"Keyed-In Card",rate:"3.4% + 30¢",icon:"⌨️",highlight:false},
              {type:"Card on File (Saved)",rate:"3.5% + 15¢",icon:"🔒",highlight:false},
            ].map(item=>(
              <div key={item.type} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18}}>{item.icon}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{item.type}</div>
                    {item.highlight&&<div style={{fontSize:10,color:C.green,fontWeight:700}}>BEST RATE</div>}
                  </div>
                </div>
                <span style={{fontSize:14,fontWeight:700,color:item.highlight?C.gold:C.text}}>{item.rate}</span>
              </div>
            ))}
            <div className="fee-breakdown">
              <div style={{fontSize:11,color:C.muted,marginBottom:8,fontWeight:700,letterSpacing:.5}}>MONTHLY FEE SUMMARY</div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:C.muted}}>Gross Volume</span><span style={{fontSize:13,fontWeight:600}}>${totalVolume.toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:C.muted}}>Stripe Fees (~2.7%)</span><span style={{fontSize:13,fontWeight:600,color:C.red}}>-${stripeFees.toFixed(2)}</span></div>
              <div style={{height:1,background:C.border,margin:"8px 0"}}/>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:14,fontWeight:700}}>Net Earnings</span><span style={{fontSize:14,fontWeight:800,color:C.green}}>${(totalVolume-stripeFees).toFixed(2)}</span></div>
            </div>
          </div>

          {/* Quick actions */}
          <p className="stit">Quick Actions</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[{icon:"📊",label:"View Reports",sub:"Revenue analytics"},{icon:"🧾",label:"Invoices",sub:"Send payment links"},{icon:"💰",label:"Instant Payout",sub:"$3.14 fee, 30 min"},{icon:"🔄",label:"Refund",sub:"Partial or full"}].map(a=>(
              <div key={a.label} className="reader-card" style={{cursor:"pointer",padding:14}} onClick={()=>showToast(`${a.label} — coming soon!`)}>
                <div style={{fontSize:24,marginBottom:8}}>{a.icon}</div>
                <div style={{fontSize:13,fontWeight:700}}>{a.label}</div>
                <div style={{fontSize:11,color:C.muted}}>{a.sub}</div>
              </div>
            ))}
          </div>
        </>}

        {/* READERS TAB */}
        {tab==="readers"&&<>
          <p className="stit">Card Readers</p>
          {readers.map(rd=>(
            <div key={rd.id} className={`reader-card${rd.status==="connected"?" connected":rd.status==="pairing"?" pairing":""}`}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:32}}>📟</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:700}}>{rd.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>S/N: {rd.serial}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div className={`reader-status-dot ${rd.status}`}/>
                  <span style={{fontSize:12,fontWeight:600,color:rd.status==="connected"?C.green:rd.status==="pairing"?C.orange:C.dim,textTransform:"capitalize"}}>{rd.status==="pairing"?"Pairing...":rd.status}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:20,marginBottom:12}}>
                <div><div style={{fontSize:10,color:C.muted}}>Location</div><div style={{fontSize:13,fontWeight:600}}>{rd.location}</div></div>
                <div><div style={{fontSize:10,color:C.muted}}>Last Used</div><div style={{fontSize:13,fontWeight:600}}>{rd.lastUsed}</div></div>
                {rd.status==="connected"&&<div><div style={{fontSize:10,color:C.muted}}>Battery</div><div style={{fontSize:13,fontWeight:600,color:rd.battery>20?C.green:C.red}}>{rd.battery}%</div></div>}
              </div>
              {rd.status==="offline"&&!pairingMode&&<button className="btn bg" style={{fontSize:13,padding:"10px"}} onClick={connectReader}>🔗 Pair Reader</button>}
              {rd.status==="offline"&&pairingMode&&<div style={{textAlign:"center",padding:"10px",background:`${C.orange}15`,borderRadius:10,border:`1px solid ${C.orange}40`}}><div style={{fontSize:12,color:C.orange,fontWeight:700,animation:"alertPulse 1.5s infinite"}}>🔍 Searching for reader... make sure it's powered on and nearby</div></div>}
              {rd.status==="connected"&&<button className="bo" style={{width:"100%",padding:"10px",fontSize:13}} onClick={()=>showToast("Reader disconnected")}>Disconnect</button>}
            </div>
          ))}
          <div className="notify-banner" style={{marginTop:8}}>
            <span style={{fontSize:22}}>💡</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>Get the lowest rates</div>
              <div style={{fontSize:12,color:C.muted}}>Always use a connected Stripe reader for card-present rates (2.7% vs 3.4%).</div>
            </div>
          </div>
        </>}

        {/* PAYOUTS TAB */}
        {tab==="payouts"&&<>
          <div style={{background:`${C.green}12`,border:`1px solid ${C.green}30`,borderRadius:16,padding:16,marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
            <span style={{fontSize:32}}>💸</span>
            <div>
              <div style={{fontSize:13,color:C.muted}}>Next payout — Feb 19</div>
              <div style={{fontSize:28,fontWeight:800,fontFamily:"'Playfair Display',serif",color:C.green}}>$1,184.60</div>
              <div style={{fontSize:11,color:C.muted}}>After Stripe fees · Chase ••4821</div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <div className="stripe-stat"><div style={{fontSize:15,fontWeight:800,color:C.text}}>2-Day</div><div style={{fontSize:10,color:C.muted}}>Payout speed</div></div>
            <div className="stripe-stat"><div style={{fontSize:15,fontWeight:800,color:C.text}}>Automatic</div><div style={{fontSize:10,color:C.muted}}>Schedule</div></div>
            <div className="stripe-stat"><div style={{fontSize:15,fontWeight:800,color:C.gold}}>Instant ↗</div><div style={{fontSize:10,color:C.muted}}>+ $3.14 fee</div></div>
          </div>
          <p className="stit">Payout History</p>
          {STRIPE_PAYOUTS.map(p=>(
            <div key={p.id} className="payout-row">
              <div>
                <div style={{fontSize:14,fontWeight:600}}>{p.date}</div>
                <div style={{fontSize:11,color:C.muted}}>{p.account} · {p.days} rolling</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:16,fontWeight:700,color:C.green}}>${p.amount.toFixed(2)}</div>
                <span className="badge bgrn" style={{fontSize:10}}>✓ Paid</span>
              </div>
            </div>
          ))}
          <button className="bo" style={{width:"100%",marginTop:16,padding:"12px",fontSize:13}} onClick={()=>showToast("Full payout history opened in browser")}>View Full History ↗</button>
        </>}

        {/* BANK TAB */}
        {tab==="bank"&&<>
          <p className="stit">Linked Bank Account</p>
          {bankLinked?(
            <div className="bank-card">
              <div className="bank-icon">🏦</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700}}>Chase Checking</div>
                <div style={{fontSize:12,color:C.muted}}>Account ••••4821 · Routing ••••0021</div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C.green,boxShadow:`0 0 4px ${C.green}`}}/>
                  <span style={{fontSize:11,color:C.green,fontWeight:600}}>Verified</span>
                </div>
              </div>
              <button className="bdgr" style={{padding:"8px 12px",fontSize:12}} onClick={()=>setConfirmUnlink(true)}>Unlink</button>
            </div>
          ):(
            <div style={{textAlign:"center",padding:"30px 0"}}>
              <div style={{fontSize:48,marginBottom:12}}>🏦</div>
              <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>No bank account linked</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Add a bank account to receive payouts from Stripe.</div>
              <button className="stripe-connect-btn" onClick={()=>{setBankLinked(true);showToast("Bank account linked!")}}>🔗 Connect Bank Account</button>
            </div>
          )}

          <p className="stit" style={{marginTop:8}}>Identity Verification</p>
          <div className="card" style={{marginBottom:12}}>
            {[{label:"Legal Name",val:"Marcus D. Johnson",done:true},{label:"SSN (last 4)",val:"••••6731",done:true},{label:"Date of Birth",val:"••/••/••••",done:true},{label:"Business EIN",val:"Not added",done:false}].map(it=>(
              <div key={it.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{it.label}</div>
                  <div style={{fontSize:12,color:C.muted}}>{it.val}</div>
                </div>
                {it.done?<span style={{color:C.green,fontSize:18}}>✓</span>:<button className="bgh" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>showToast("Identity form opened")}>Add</button>}
              </div>
            ))}
          </div>

          <p className="stit">Tax Documents</p>
          <div className="card">
            {[{year:"2025",form:"1099-K",status:"Available"},{year:"2024",form:"1099-K",status:"Available"}].map(t=>(
              <div key={t.year} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{t.form} · {t.year}</div>
                  <div style={{fontSize:11,color:C.muted}}>Stripe tax document</div>
                </div>
                <button className="bgh" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>showToast("Downloading "+t.year+" "+t.form+"...")}>Download</button>
              </div>
            ))}
          </div>
        </>}
      </div>

      {/* Unlink confirm */}
      {confirmUnlink&&(
        <div className="ov" onClick={()=>setConfirmUnlink(false)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <div className="mh"/>
            <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:8}}>Unlink Bank Account?</h3>
            <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Payouts will be paused until you add a new bank account. This cannot be undone immediately.</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button className="bo" style={{padding:"12px"}} onClick={()=>setConfirmUnlink(false)}>Cancel</button>
              <button className="bdgr" style={{borderRadius:12,padding:"12px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600}} onClick={()=>{setBankLinked(false);setConfirmUnlink(false);showToast("Bank account unlinked")}}>Unlink</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// ONLINE BOOKING FLOW POLISH
// ══════════════════════════════════════════
function BookingFlowPolished({onClose}){
  const [tab,setTab]=useState("confirmations"); // confirmations | sms | reminders | settings
  const [selClient,setSelClient]=useState(CLIENTS[0]);
  const [reminderSettings,setReminderSettings]=useState({h24:true,h1:true,followUp:true,custom:false,customHrs:3});
  const [autoConfirm,setAutoConfirm]=useState(true);
  const [showSmsCompose,setShowSmsCompose]=useState(false);
  const [smsText,setSmsText]=useState("");
  const [toast,setToast]=useState("");

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500)};

  const thread=SMS_THREADS[selClient.name]||[];

  const CONFIRMATION_TEMPLATES=[
    {id:"booking",icon:"✅",label:"Booking Confirmed",preview:"Hey [Name]! Your [Service] is confirmed for [Date] at [Time]. Reply CANCEL to cancel."},
    {id:"reminder24",icon:"⏰",label:"24hr Reminder",preview:"Reminder: Your [Service] is tomorrow at [Time]. We're looking forward to seeing you! 💈"},
    {id:"reminder1",icon:"🔔",label:"1hr Reminder",preview:"Hey [Name] — you're coming in about an hour. Address: 123 Barber St. See you soon!"},
    {id:"noshow",icon:"🚫",label:"No-Show Notice",preview:"We noticed you missed your [Time] appt today. A $[Fee] no-show fee has been applied. Book again: [Link]"},
    {id:"followup",icon:"⭐",label:"Post-Visit Review Ask",preview:"Thanks for coming in [Name]! How'd we do? Leave a quick review: g.co/chopitup 🌟"},
    {id:"rebooking",icon:"🔄",label:"Re-booking Nudge",preview:"Hey [Name] — it's been a few weeks! Ready for your next cut? Book at chopitup.app 💈"},
  ];

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      {/* Header */}
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:18,fontWeight:700}}>Booking & Comms</h2>
          <div style={{width:60}}/>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {[{id:"confirmations",label:"Messages"},{id:"sms",label:"SMS Thread"},{id:"reminders",label:"Reminders"},{id:"settings",label:"Settings"}].map(t=>(
            <div key={t.id} className={`ptab${tab===t.id?" act":""}`} onClick={()=>setTab(t.id)} style={{fontSize:11}}>{t.label}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {/* MESSAGES / CONFIRMATION TEMPLATES TAB */}
        {tab==="confirmations"&&<>
          <div className="confirm-card">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:28}}>✅</span>
              <div>
                <div style={{fontSize:15,fontWeight:700}}>Auto-Confirmations {autoConfirm?"ON":"OFF"}</div>
                <div style={{fontSize:12,color:C.muted}}>Messages send automatically when booking is made</div>
              </div>
              <Tog on={autoConfirm} toggle={()=>setAutoConfirm(v=>!v)}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1,background:`${C.green}10`,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:800,color:C.green}}>94%</div>
                <div style={{fontSize:10,color:C.muted}}>Open rate</div>
              </div>
              <div style={{flex:1,background:`${C.blue}10`,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:800,color:C.blue}}>78%</div>
                <div style={{fontSize:10,color:C.muted}}>Response rate</div>
              </div>
              <div style={{flex:1,background:`${C.gold}10`,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:800,color:C.gold}}>12%</div>
                <div style={{fontSize:10,color:C.muted}}>No-show reduction</div>
              </div>
            </div>
          </div>

          <p className="stit">Message Templates</p>
          {CONFIRMATION_TEMPLATES.map(tmpl=>(
            <div key={tmpl.id} className="review-card" style={{cursor:"default"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>{tmpl.icon}</span>
                  <span style={{fontSize:14,fontWeight:700}}>{tmpl.label}</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button className="bgh" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>showToast("Template editor opened")}>Edit</button>
                </div>
              </div>
              <div style={{background:C.bg,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                <p style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{tmpl.preview}</p>
              </div>
            </div>
          ))}
        </>}

        {/* SMS THREAD TAB */}
        {tab==="sms"&&<>
          {/* Client selector */}
          <p className="stit">Client</p>
          <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:16,paddingBottom:4,scrollbarWidth:"none"}}>
            {CLIENTS.slice(0,5).map(c=>(
              <div key={c.id} onClick={()=>setSelClient(c)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",flexShrink:0}}>
                <div className="pav" style={{width:44,height:44,fontSize:16,background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`,border:`2px solid ${selClient.id===c.id?C.gold:"transparent"}`,transition:"border .18s"}}>{c.avatar}</div>
                <span style={{fontSize:10,color:selClient.id===c.id?C.gold:C.muted,fontWeight:600}}>{c.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>

          {/* Thread header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${C.border}`,marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div className="pav" style={{width:38,height:38,fontSize:15,background:`linear-gradient(135deg,${selClient.gradient[0]},${selClient.gradient[1]})`}}>{selClient.avatar}</div>
              <div><div style={{fontSize:14,fontWeight:700}}>{selClient.name}</div><div style={{fontSize:11,color:C.muted}}>{selClient.phone}</div></div>
            </div>
            <button className="bgh" style={{fontSize:12}} onClick={()=>showToast(`Calling ${selClient.name}...`)}>📞 Call</button>
          </div>

          {/* SMS messages */}
          {thread.length>0?(
            <div className="sms-thread">
              {thread.map((msg,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:msg.from==="barber"?"flex-end":"flex-start"}}>
                  {(i===0||thread[i-1].from!==msg.from)&&<div className="sms-time">{msg.time}</div>}
                  <div className={`sms-msg ${msg.from==="barber"?"out":"in"}`}>{msg.text}</div>
                </div>
              ))}
            </div>
          ):(
            <div style={{textAlign:"center",padding:"30px 0",color:C.muted}}>
              <div style={{fontSize:36,marginBottom:10}}>💬</div>
              <div style={{fontSize:14,fontWeight:600,color:C.text}}>No messages yet</div>
              <div style={{fontSize:12}}>Send a message to start the conversation</div>
            </div>
          )}

          {/* Compose area */}
          {!showSmsCompose?(
            <div style={{display:"flex",gap:8,position:"sticky",bottom:80,background:C.bg,paddingTop:12}}>
              <button className="bgh" style={{flex:1,padding:"11px",fontSize:13}} onClick={()=>setShowSmsCompose(true)}>✏️ New Message</button>
              <button className="btn bg" style={{flex:1,fontSize:13}} onClick={()=>{showToast("Reminder sent!");}}> ⏰ Send Reminder</button>
            </div>
          ):(
            <div style={{position:"sticky",bottom:80,background:C.bg,paddingTop:12}}>
              <textarea className="txa" rows={3} placeholder="Type a message..." value={smsText} onChange={e=>setSmsText(e.target.value)} style={{marginBottom:10}}/>
              <div style={{display:"flex",gap:8}}>
                <button className="bo" style={{flex:1,padding:"10px"}} onClick={()=>{setShowSmsCompose(false);setSmsText("");}}>Cancel</button>
                <button className="btn bg" style={{flex:2,fontSize:14}} onClick={()=>{showToast("Message sent!");setShowSmsCompose(false);setSmsText("");}} disabled={!smsText.trim()}>Send 📱</button>
              </div>
            </div>
          )}
        </>}

        {/* REMINDERS TAB */}
        {tab==="reminders"&&<>
          <div className="booking-timeline" style={{marginBottom:16}}>
            <p style={{fontSize:13,fontWeight:700,marginBottom:14,color:C.gold}}>📅 Automated Reminder Flow</p>
            {[
              {time:"At booking",icon:"✅",label:"Confirmation SMS",active:true,always:true},
              {time:"24 hrs before",icon:"⏰",label:"24-Hour Reminder",active:reminderSettings.h24,key:"h24"},
              {time:"1 hr before",icon:"🔔",label:"1-Hour Reminder",active:reminderSettings.h1,key:"h1"},
              {time:"After visit",icon:"⭐",label:"Review Request",active:reminderSettings.followUp,key:"followUp"},
              {time:"3 wks later",icon:"🔄",label:"Re-booking Nudge",active:true,always:true},
            ].map((step,i,arr)=>(
              <div key={step.time} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div className="booking-step-dot" style={{background:step.active?`${C.gold}20`:C.surface,border:`2px solid ${step.active?C.gold:C.border}`,color:step.active?C.gold:C.dim}}>
                    {step.icon}
                  </div>
                  {i<arr.length-1&&<div className="booking-step-line"/>}
                </div>
                <div style={{flex:1,paddingTop:4,paddingBottom:i<arr.length-1?20:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:step.active?C.text:C.dim}}>{step.label}</div>
                      <div style={{fontSize:11,color:C.muted}}>{step.time}</div>
                    </div>
                    {!step.always&&<Tog on={step.active} toggle={()=>setReminderSettings(s=>({...s,[step.key]:!s[step.key]}))}/>}
                    {step.always&&<span className="badge bgold" style={{fontSize:9}}>AUTO</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="stit">Custom Reminder</p>
          <div className="card" style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                <div style={{fontSize:14,fontWeight:600}}>Custom Time Reminder</div>
                <div style={{fontSize:12,color:C.muted}}>Additional reminder at custom hours before</div>
              </div>
              <Tog on={reminderSettings.custom} toggle={()=>setReminderSettings(s=>({...s,custom:!s.custom}))}/>
            </div>
            {reminderSettings.custom&&(
              <div>
                <label className="lbl">Hours before appointment</label>
                <div style={{display:"flex",gap:8}}>
                  {[2,3,4,6,12].map(h=>(
                    <div key={h} className={`remind-chip${reminderSettings.customHrs===h?" sel":""}`} onClick={()=>setReminderSettings(s=>({...s,customHrs:h}))}>{h}h</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="stit">No-Show Response</p>
          <div className="card">
            {[{label:"No-show SMS",sub:"Send message when client misses appt",key:"ns"},{label:"Fee notification",sub:"Tell client about no-show fee",key:"nsfee"}].map(({label,sub,key})=>(
              <div key={key} className="trow">
                <div><div style={{fontSize:14,fontWeight:600}}>{label}</div><div style={{fontSize:12,color:C.muted}}>{sub}</div></div>
                <Tog on={true} toggle={()=>showToast("Setting updated")}/>
              </div>
            ))}
          </div>
        </>}

        {/* SETTINGS TAB */}
        {tab==="settings"&&<>
          <p className="stit">Booking Page</p>
          <div className="card" style={{marginBottom:14}}>
            {[{label:"Online booking",sub:"Allow clients to book via link",on:true},{label:"Require phone number",sub:"Collect phone at booking",on:true},{label:"Require deposit",sub:"50% deposit to confirm slot",on:false},{label:"Auto-confirm bookings",sub:"No manual approval needed",on:autoConfirm},{label:"Allow cancellations",sub:"Client can cancel up to 24hrs",on:true}].map(({label,sub,on},i)=>(
              <div key={label} className="trow">
                <div><div style={{fontSize:14,fontWeight:600}}>{label}</div><div style={{fontSize:12,color:C.muted}}>{sub}</div></div>
                <Tog on={on} toggle={()=>showToast("Setting updated")}/>
              </div>
            ))}
          </div>

          <p className="stit">Booking Link</p>
          <div className="card" style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0"}}>
              <div style={{flex:1,background:C.bg,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                <span style={{fontSize:12,color:C.gold,fontFamily:"monospace"}}>chopitup.app/marcus</span>
              </div>
              <button className="bgh" style={{flexShrink:0}} onClick={()=>showToast("Link copied!")}>Copy</button>
              <button className="bgh" style={{flexShrink:0}} onClick={()=>showToast("Link shared!")}>Share</button>
            </div>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              {["📸 QR Code","🖨 Print Flyer","📲 Add to Bio"].map(a=>(
                <button key={a} className="bo" style={{flex:1,padding:"9px",fontSize:11,borderRadius:10}} onClick={()=>showToast(a+" — opened!")}>{a}</button>
              ))}
            </div>
          </div>

          <p className="stit">Cancellation Policy</p>
          <div className="card">
            <div style={{marginBottom:12}}>
              <label className="lbl">Cancellation window (hours)</label>
              <div style={{display:"flex",gap:8}}>
                {[12,24,48,72].map(h=>(
                  <div key={h} className={`remind-chip${h===24?" sel":""}`} onClick={()=>showToast("Policy updated")}>{h}h</div>
                ))}
              </div>
            </div>
            <div className="trow" style={{borderBottom:"none"}}>
              <div><div style={{fontSize:14,fontWeight:600}}>Late cancel fee</div><div style={{fontSize:12,color:C.muted}}>Charge 50% if cancelled late</div></div>
              <Tog on={false} toggle={()=>showToast("Setting updated")}/>
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// SERVICE MENU BUILDER & PRICING
// ══════════════════════════════════════════
function ServiceMenuScreen({onClose}){
  const [services,setServices]=useState(SVCS_INIT);
  const [filterCat,setFilterCat]=useState("All");
  const [editSvc,setEditSvc]=useState(null);
  const [addMode,setAddMode]=useState(false);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const cats=["All",...[...new Set(SVCS_INIT.map(s=>s.category))]];
  const shown=filterCat==="All"?services:services.filter(s=>s.category===filterCat);
  const [form,setForm]=useState({name:"",category:"Cuts",price:30,duration:45,desc:"",featured:false,addOns:[]});

  const saveEdit=()=>{
    if(editSvc){
      setServices(ss=>ss.map(s=>s.id===editSvc.id?{...editSvc}:s));
      showToast("Service updated!");
    } else {
      setServices(ss=>[...ss,{...form,id:Date.now(),popular:false,icon:"✂️",addOns:[]}]);
      showToast("Service added!");
    }
    setEditSvc(null);setAddMode(false);
  };

  const deleteSvc=id=>{setServices(ss=>ss.filter(s=>s.id!==id));showToast("Service removed");};
  const toggleFeatured=id=>{setServices(ss=>ss.map(s=>s.id===id?{...s,featured:!s.featured}:s));};

  const totalRevPotential=services.reduce((a,s)=>a+s.price,0);

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Service Menu</h2>
          <button className="bgh" onClick={()=>{setAddMode(true);setEditSvc(null);setForm({name:"",category:"Cuts",price:30,duration:45,desc:"",featured:false,addOns:[]});}}>+ Add</button>
        </div>
        {/* Stats strip */}
        <div style={{display:"flex",gap:10,marginBottom:14}}>
          {[{label:"Services",val:services.length},{label:"Categories",val:[...new Set(services.map(s=>s.category))].length},{label:"Avg Price",val:"$"+Math.round(services.reduce((a,s)=>a+s.price,0)/services.length)}].map(({label,val})=>(
            <div key={label} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:800,color:C.gold}}>{val}</div>
              <div style={{fontSize:10,color:C.muted}}>{label}</div>
            </div>
          ))}
        </div>
        {/* Category filter */}
        <div style={{display:"flex",gap:8,overflowX:"auto",scrollbarWidth:"none",paddingBottom:4}}>
          {cats.map(c=><div key={c} className={`svc-cat-chip${filterCat===c?" sel":""}`} onClick={()=>setFilterCat(c)}>{c}</div>)}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {shown.map(svc=>(
          <div key={svc.id} className={`svc-builder-card${svc.featured?" featured":""}`}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{width:44,height:44,borderRadius:12,background:`${C.gold}18`,border:`1px solid ${C.gold}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{svc.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:15,fontWeight:700}}>{svc.name}</span>
                  {svc.popular&&<span className="badge bgold" style={{fontSize:9}}>POPULAR</span>}
                  {svc.featured&&<span className="badge" style={{fontSize:9,background:`${C.gold}20`,color:C.gold,border:`1px solid ${C.gold}40`}}>FEATURED</span>}
                </div>
                <div style={{fontSize:12,color:C.muted,marginBottom:6}}>{svc.desc}</div>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{fontSize:16,fontWeight:800,color:C.gold}}>${svc.price}</span>
                  <span style={{fontSize:12,color:C.dim}}>⏱ {svc.duration}min</span>
                  <span className="badge bblu" style={{fontSize:10}}>{svc.category}</span>
                </div>
                {svc.addOns&&svc.addOns.length>0&&(
                  <div style={{marginTop:8}}>
                    {svc.addOns.map(a=><span key={a} className="add-on-tag">+{a}</span>)}
                  </div>
                )}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                <button className="bgh" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>{setEditSvc({...svc});setAddMode(false);}}>Edit</button>
                <button onClick={()=>toggleFeatured(svc.id)} style={{background:svc.featured?`${C.gold}20`:"transparent",border:`1px solid ${svc.featured?C.gold:C.border}`,borderRadius:8,padding:"5px 10px",color:svc.featured?C.gold:C.muted,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>★</button>
                <button onClick={()=>deleteSvc(svc.id)} style={{background:"transparent",border:"none",color:C.dim,fontSize:16,cursor:"pointer",padding:"2px",fontFamily:"'DM Sans',sans-serif"}}>✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add modal */}
      {(editSvc||addMode)&&(
        <div className="ov" onClick={()=>{setEditSvc(null);setAddMode(false);}}>
          <div className="mod" onClick={e=>e.stopPropagation()} style={{maxHeight:"88vh",overflowY:"auto"}}>
            <div className="mh"/>
            <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:16}}>{editSvc?"Edit Service":"New Service"}</h3>
            {[
              {label:"Service Name",key:"name",type:"text",ph:"e.g. Fade, Braids..."},
              {label:"Description",key:"desc",type:"text",ph:"Short description"},
              {label:"Price ($)",key:"price",type:"number",ph:"0"},
            ].map(({label,key,type,ph})=>(
              <div key={key} style={{marginBottom:12}}>
                <label className="lbl">{label}</label>
                <input className="inp" type={type} placeholder={ph} value={editSvc?editSvc[key]:form[key]} onChange={e=>{
                  const v=type==="number"?Number(e.target.value):e.target.value;
                  editSvc?setEditSvc(s=>({...s,[key]:v})):setForm(f=>({...f,[key]:v}));
                }}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <label className="lbl">Duration</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[15,20,30,45,60,90,120].map(d=>(
                  <div key={d} className={`dur-chip${(editSvc?editSvc.duration:form.duration)===d?" sel":""}`} onClick={()=>editSvc?setEditSvc(s=>({...s,duration:d})):setForm(f=>({...f,duration:d}))}>{d}m</div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <label className="lbl">Category</label>
              <select className="sel" value={editSvc?editSvc.category:form.category} onChange={e=>editSvc?setEditSvc(s=>({...s,category:e.target.value})):setForm(f=>({...f,category:e.target.value}))}>
                {["Cuts","Combos","Color","Braids","Beard","Kids","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button className="bo" style={{padding:"12px"}} onClick={()=>{setEditSvc(null);setAddMode(false);}}>Cancel</button>
              <button className="btn bg" onClick={saveEdit}>Save Service</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// CLIENT REFERRAL PROGRAM
// ══════════════════════════════════════════
function ReferralScreen({onClose}){
  const [referrals,setReferrals]=useState(REFERRALS_INIT);
  const [tab,setTab]=useState("overview"); // overview | track | settings
  const [toast,setToast]=useState("");
  const [shareModal,setShareModal]=useState(false);
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const myCode="CHOP-MJ47";
  const myLink="chopitup.app/ref/MJ47";
  const totalReferred=referrals.length;
  const rewarded=referrals.filter(r=>r.stage==="rewarded").length;
  const earned=rewarded*10;

  const REWARD_TIERS=[
    {refs:1,reward:"$10 off next service",icon:"🎁",unlocked:true},
    {refs:3,reward:"Free beard trim",icon:"🪒",unlocked:totalReferred>=3},
    {refs:5,reward:"Free fade ($35 value)",icon:"✂️",unlocked:totalReferred>=5},
    {refs:10,reward:"Platinum status + $50 credit",icon:"👑",unlocked:totalReferred>=10},
  ];

  const stageLabel={s:"signed-up",v:"visited",r:"rewarded"};
  const stageMeta={
    "signed-up":{label:"Signed Up",color:C.orange,dot:"signed-up"},
    "visited":{label:"Visited",color:C.blue,dot:"visited"},
    "rewarded":{label:"Reward Earned",color:C.green,dot:"rewarded"},
  };

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Referrals</h2>
          <button className="bgh" onClick={()=>setShareModal(true)}>Share</button>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {["overview","track","settings"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="overview"&&<>
          {/* Referral code card */}
          <div className="ref-code-card">
            <div style={{fontSize:13,color:C.muted,marginBottom:4,letterSpacing:.5}}>YOUR REFERRAL CODE</div>
            <div className="ref-code">{myCode}</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Share this code — your client gets $10 off, you get $10 credit when they visit!</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              {["📋 Copy","📱 Text","📲 Share"].map(a=>(
                <button key={a} className="bgh" style={{fontSize:12,padding:"8px 14px"}} onClick={()=>showToast(a.split(" ")[1]+" — sent!")}>{a}</button>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
            {[{label:"Referred",val:totalReferred,color:C.blue,icon:"👥"},{label:"Visited",val:referrals.filter(r=>r.stage!=="signed-up").length,color:C.gold,icon:"✅"},{label:"$ Earned",val:`$${earned}`,color:C.green,icon:"💰"}].map(({label,val,color,icon})=>(
              <div key={label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 10px",textAlign:"center"}}>
                <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
                <div style={{fontSize:20,fontWeight:800,color}}>{val}</div>
                <div style={{fontSize:10,color:C.muted}}>{label}</div>
              </div>
            ))}
          </div>

          {/* Reward tiers */}
          <p className="stit">Reward Milestones</p>
          {REWARD_TIERS.map(t=>(
            <div key={t.refs} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.border}`,opacity:t.unlocked?1:.5}}>
              <div style={{width:44,height:44,borderRadius:12,background:t.unlocked?`${C.gold}20`:C.surface,border:`1px solid ${t.unlocked?C.gold:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{t.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:t.unlocked?C.text:C.muted}}>{t.reward}</div>
                <div style={{fontSize:12,color:C.dim}}>{t.refs} referral{t.refs>1?"s":""} required</div>
              </div>
              {t.unlocked?<span style={{color:C.green,fontSize:20,fontWeight:700}}>✓</span>:<span style={{color:C.dim,fontSize:12}}>{t.refs - Math.min(totalReferred,t.refs)} more</span>}
            </div>
          ))}
        </>}

        {tab==="track"&&<>
          <p className="stit">All Referrals ({referrals.length})</p>
          {referrals.map(r=>{
            const meta=stageMeta[r.stage];
            return(
              <div key={r.id+r.referredName} className="ref-person-row">
                <div className="pav" style={{width:38,height:38,fontSize:14,background:`linear-gradient(135deg,${r.color},${r.color}88)`,flexShrink:0}}>{r.avatar}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name} → {r.referredName}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
                    <div className={`ref-stage-dot ${r.stage}`}/>
                    <span style={{fontSize:11,color:meta.color,fontWeight:600}}>{meta.label}</span>
                    <span style={{fontSize:11,color:C.dim}}>· {r.date}</span>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:r.earned?C.green:C.muted}}>{r.reward}</div>
                  {r.earned&&<div style={{fontSize:10,color:C.green}}>✓ Credited</div>}
                </div>
              </div>
            );
          })}
          {referrals.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:10}}>📨</div><div style={{fontSize:15,color:C.text}}>No referrals yet</div><div style={{fontSize:12,marginTop:4}}>Share your code to start earning!</div></div>}
        </>}

        {tab==="settings"&&<>
          <p className="stit">Program Settings</p>
          <div className="card" style={{marginBottom:14}}>
            {[
              {label:"Referral program active",sub:"Allow clients to refer friends",on:true},
              {label:"Auto-apply reward",sub:"Credit applies automatically",on:true},
              {label:"Double-reward week",sub:"2x rewards for limited time",on:false},
              {label:"Notify on new referral",sub:"Push alert when someone uses your link",on:true},
            ].map(({label,sub,on},i)=>(
              <div key={i} className="trow">
                <div><div style={{fontSize:14,fontWeight:600}}>{label}</div><div style={{fontSize:12,color:C.muted}}>{sub}</div></div>
                <Tog on={on} toggle={()=>showToast("Setting updated")}/>
              </div>
            ))}
          </div>
          <p className="stit">Reward Structure</p>
          <div className="card">
            <div style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
              <label className="lbl">Referrer reward (per visit)</label>
              <div style={{display:"flex",gap:8}}>
                {["$5","$10","$15","$20"].map(v=>(
                  <div key={v} className={`remind-chip${v==="$10"?" sel":""}`} onClick={()=>showToast("Reward updated to "+v)}>{v}</div>
                ))}
              </div>
            </div>
            <div>
              <label className="lbl">New client discount</label>
              <div style={{display:"flex",gap:8}}>
                {["$5","$10","$15","Free service"].map(v=>(
                  <div key={v} className={`remind-chip${v==="$10"?" sel":""}`} style={{fontSize:11}} onClick={()=>showToast("Discount set to "+v)}>{v}</div>
                ))}
              </div>
            </div>
          </div>
        </>}
      </div>

      {/* Share modal */}
      {shareModal&&(
        <div className="ov" onClick={()=>setShareModal(false)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <div className="mh"/>
            <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:14}}>Share Your Referral</h3>
            <div className="ref-link-row">
              <span style={{fontSize:12,color:C.gold,flex:1,fontFamily:"monospace"}}>{myLink}</span>
              <button className="bgh" style={{fontSize:11,padding:"6px 12px",flexShrink:0}} onClick={()=>showToast("Link copied!")}>Copy</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[{icon:"💬",label:"iMessage"},{icon:"📷",label:"Instagram Story"},{icon:"👍",label:"Facebook"},{icon:"🐦",label:"X / Twitter"}].map(({icon,label})=>(
                <button key={label} className="bo" style={{display:"flex",alignItems:"center",gap:8,padding:"12px",justifyContent:"center",borderRadius:12}} onClick={()=>{showToast("Shared to "+label);setShareModal(false);}}>
                  <span style={{fontSize:20}}>{icon}</span><span style={{fontSize:13}}>{label}</span>
                </button>
              ))}
            </div>
            <div style={{textAlign:"center",padding:"14px 0",borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:8}}>OR — send your QR code</div>
              <div style={{width:120,height:120,background:C.card,border:`1px solid ${C.border}`,borderRadius:16,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48}}>📱</div>
              <div style={{fontSize:12,color:C.muted,marginTop:8}}>QR code for printing / in-shop display</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// AI REVENUE FORECASTING & GOALS
// ══════════════════════════════════════════
function ForecastingScreen({onClose}){
  const [tab,setTab]=useState("forecast"); // forecast | goals | insights
  const [goals,setGoals]=useState(GOALS_INIT);
  const [editGoal,setEditGoal]=useState(null);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const [animBars,setAnimBars]=useState(false);
  useEffect(()=>{setTimeout(()=>setAnimBars(true),200);},[]);

  const maxRev=Math.max(...ACTUAL_REVENUE.filter(v=>v>0),...PROJECTED_REV.filter(v=>v>0));

  const AI_INSIGHTS=[
    {icon:"📈",title:"March looks strong",body:"Based on your Feb growth (+18%) and appointment bookings, March revenue is projected at $2,650 — your best month yet.",action:"View March plan"},
    {icon:"🎯",title:"Review goal needs attention",body:"You're 4 reviews short of your monthly goal. Sending review requests after each appointment could close the gap by Feb 28.",action:"Send requests"},
    {icon:"💡",title:"Tuesday is underperforming",body:"Tuesdays average 3 fewer appointments than other weekdays. A Tuesday-only promo could generate ~$420/month.",action:"Create promo"},
    {icon:"🔄",title:"Re-booking opportunity",body:"8 clients haven't returned in 3+ weeks. A targeted SMS blast could recover $380+ in potential revenue.",action:"Send blast"},
    {icon:"💰",title:"Raise your color price",body:"Your color service ($75) is 18% below the local average ($89). Adjusting could add ~$140/month without losing clients.",action:"Update price"},
  ];

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Forecast & Goals</h2>
          <div style={{width:60}}/>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {[{id:"forecast",label:"Forecast"},{id:"goals",label:"Goals"},{id:"insights",label:"AI Insights"}].map(t=>(
            <div key={t.id} className={`ptab${tab===t.id?" act":""}`} onClick={()=>setTab(t.id)}>{t.label}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="forecast"&&<>
          <div className="forecast-hero">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:2}}>Projected — Next 4 months</div>
                <div style={{fontSize:32,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.purple}}>$11,970</div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                  <span style={{fontSize:13,color:C.green,fontWeight:700}}>↑ +31%</span>
                  <span style={{fontSize:12,color:C.muted}}>vs last 4 months</span>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:C.muted}}>AI Confidence</div>
                <div style={{fontSize:20,fontWeight:800,color:C.purple}}>87%</div>
              </div>
            </div>

            {/* Bar chart */}
            <div className="forecast-bar-wrap">
              {FORECAST_MONTHS.map((m,i)=>{
                const actual=ACTUAL_REVENUE[i];
                const proj=PROJECTED_REV[i];
                const val=actual||proj;
                const h=animBars?Math.round((val/maxRev)*80):2;
                const isProj=proj>0;
                return(
                  <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div className={`forecast-bar ${isProj?"projected":"actual"}`} style={{height:h,width:"100%",transitionDelay:`${i*40}ms`}}/>
                    <span style={{fontSize:9,color:isProj?C.purple:C.muted,fontWeight:isProj?700:400}}>{m}</span>
                  </div>
                );
              })}
            </div>

            <div style={{display:"flex",gap:16,marginTop:4}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:2,background:C.gold}}/><span style={{fontSize:11,color:C.muted}}>Actual</span></div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:2,background:C.purple,border:"1px dashed rgba(167,139,250,.7)"}}/><span style={{fontSize:11,color:C.muted}}>AI Projected</span></div>
            </div>
          </div>

          {/* Monthly breakdown */}
          <p className="stit">Revenue Breakdown</p>
          <div className="card" style={{marginBottom:14}}>
            {[{m:"Mar 2026",v:2650,pct:"+16%"},{m:"Apr 2026",v:2880,pct:"+9%"},{m:"May 2026",v:3100,pct:"+8%"},{m:"Jun 2026",v:3340,pct:"+8%"}].map(({m,v,pct})=>(
              <div key={m} className="eod-row">
                <span style={{fontSize:14,fontWeight:600}}>{m}</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:13,color:C.green,fontWeight:700}}>{pct}</span>
                  <span style={{fontSize:15,fontWeight:800,color:C.purple}}>${v.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="stit">Key Drivers</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[{icon:"👥",label:"New clients/mo",val:"+3",color:C.blue},{icon:"🔄",label:"Retention rate",val:"84%",color:C.green},{icon:"🎫",label:"Avg ticket",val:"$51",color:C.gold},{icon:"📅",label:"Fill rate",val:"78%",color:C.purple}].map(({icon,label,val,color})=>(
              <div key={label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,textAlign:"center"}}>
                <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
                <div style={{fontSize:22,fontWeight:800,color}}>{val}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
        </>}

        {tab==="goals"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p className="stit" style={{margin:0}}>Active Goals</p>
            <button className="bgh" style={{fontSize:12}} onClick={()=>showToast("New goal form — coming soon!")}>+ New Goal</button>
          </div>
          {goals.map(g=>{
            const pct=Math.min(100,Math.round((g.current/g.target)*100));
            const statusColor=g.status==="exceeded"?C.gold:g.status==="on-track"?C.green:C.orange;
            return(
              <div key={g.id} className={`goal-card ${g.status}`}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:24}}>{g.icon}</span>
                    <div>
                      <div style={{fontSize:15,fontWeight:700}}>{g.label}</div>
                      <div style={{fontSize:11,color:C.muted}}>{g.period}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,color:statusColor,fontWeight:700,textTransform:"uppercase"}}>{g.status.replace("-"," ")}</div>
                    <div style={{fontSize:18,fontWeight:800,color:statusColor}}>{pct}%</div>
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:13,color:C.muted}}>Current</span>
                  <span style={{fontSize:14,fontWeight:700}}>{g.unit==="$"?"$":""}{g.current.toLocaleString()}{g.unit!=="$"?g.unit:""}</span>
                </div>
                <div className="pb" style={{marginBottom:8}}>
                  <div className="pbf" style={{width:`${pct}%`,background:statusColor}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,color:C.muted}}>Target: {g.unit==="$"?"$":""}{g.target.toLocaleString()}{g.unit!=="$"?g.unit:""}</span>
                  <span style={{fontSize:12,color:C.muted}}>{g.unit==="$"?"$":""}{(g.target-g.current).toLocaleString()}{g.unit!=="$"?g.unit:""} to go</span>
                </div>
              </div>
            );
          })}
        </>}

        {tab==="insights"&&<>
          <div className="forecast-hero" style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:C.purple,marginBottom:6}}>🤖 AI Analysis — Feb 20, 2026</div>
            <p style={{fontSize:13,lineHeight:1.6,color:C.text}}>Based on your last 6 months of data, you're on a <strong style={{color:C.green}}>strong growth trajectory</strong>. Your biggest opportunities are in review collection, Tuesday utilization, and a small price adjustment on Color services.</p>
          </div>
          <p className="stit">Personalized Insights</p>
          {AI_INSIGHTS.map((ins,i)=>(
            <div key={i} className="ai-insight-card">
              <div className="insight-icon-wrap">{ins.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>{ins.title}</div>
                <div style={{fontSize:12,lineHeight:1.5,color:C.muted,marginBottom:8}}>{ins.body}</div>
                <button className="bgh" style={{fontSize:11,padding:"5px 12px"}} onClick={()=>showToast(ins.action+" — opened!")}>{ins.action} →</button>
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// DAILY CASH-OUT / END-OF-DAY REPORT
// ══════════════════════════════════════════
function CashOutScreen({onClose}){
  const [step,setStep]=useState("summary"); // summary | cash | close | receipt
  const [denoms,setDenoms]=useState(DENOMINATIONS);
  const [notes,setNotes]=useState("");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const systemTotal=PAYMENT_METHODS_EOD.reduce((a,m)=>a+m.expected,0);
  const cashInDenoms=denoms.reduce((a,d)=>a+d.val*d.qty,0);
  const cashExpected=PAYMENT_METHODS_EOD.find(m=>m.id==="cash").expected;
  const cashDiff=cashInDenoms-cashExpected;
  const discStatus=Math.abs(cashDiff)<1?"ok":Math.abs(cashDiff)<=20?"warn":"err";
  const discColors={ok:C.green,warn:C.orange,err:C.red};

  const updateDenom=(idx,delta)=>{
    setDenoms(ds=>ds.map((d,i)=>i===idx?{...d,qty:Math.max(0,d.qty+delta)}:d));
  };

  const APPTS_TODAY=[
    {name:"Marcus J.",service:"Fade + Beard",amount:54,time:"10:00 AM",paid:"card"},
    {name:"DeShawn W.",service:"Shape-Up",amount:30,time:"11:30 AM",paid:"applepay"},
    {name:"Tre L.",service:"Braids",amount:115,time:"2:00 PM",paid:"cash"},
    {name:"Carlos M.",service:"Color",amount:85,time:"3:30 PM",paid:"card"},
    {name:"Brandon K.",service:"Haircut",amount:37,time:"5:00 PM",paid:"card"},
  ];

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>End of Day</h2>
          <span style={{fontSize:12,color:C.muted}}>Feb 20, 2026</span>
        </div>
        {/* Step indicator */}
        <div style={{display:"flex",gap:6}}>
          {["Summary","Cash Count","Close Out","Receipt"].map((s,i)=>{
            const steps=["summary","cash","close","receipt"];
            const idx=steps.indexOf(step);
            return(
              <div key={s} style={{flex:1,textAlign:"center"}}>
                <div style={{height:3,borderRadius:2,background:i<=idx?C.gold:C.border,marginBottom:4,transition:"background .3s"}}/>
                <span style={{fontSize:9,color:i<=idx?C.gold:C.dim,fontWeight:600}}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:12,paddingBottom:100}}>

        {step==="summary"&&<>
          <div className="cashout-hero">
            <div style={{fontSize:12,color:C.muted,marginBottom:4,letterSpacing:.5}}>TODAY'S GROSS REVENUE</div>
            <div style={{fontSize:44,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.green,lineHeight:1}}>${systemTotal.toFixed(2)}</div>
            <div style={{display:"flex",justifyContent:"center",gap:20,marginTop:12}}>
              <div><div style={{fontSize:18,fontWeight:800,color:C.text}}>5</div><div style={{fontSize:10,color:C.muted}}>Appointments</div></div>
              <div><div style={{fontSize:18,fontWeight:800,color:C.text}}>$62</div><div style={{fontSize:10,color:C.muted}}>Avg Ticket</div></div>
              <div><div style={{fontSize:18,fontWeight:800,color:C.text}}>$48</div><div style={{fontSize:10,color:C.muted}}>Total Tips</div></div>
            </div>
          </div>

          <p className="stit">By Payment Method</p>
          <div className="card" style={{marginBottom:14}}>
            {PAYMENT_METHODS_EOD.map(m=>(
              <div key={m.id} className="eod-row">
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>{m.icon}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{m.label}</div>
                  </div>
                </div>
                <span style={{fontSize:16,fontWeight:800,color:m.color}}>${m.expected.toFixed(2)}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderTop:`1px solid ${C.border}`,marginTop:4}}>
              <span style={{fontSize:15,fontWeight:700}}>Total</span>
              <span style={{fontSize:18,fontWeight:900,color:C.green,fontFamily:"'Playfair Display',serif"}}>${systemTotal.toFixed(2)}</span>
            </div>
          </div>

          <p className="stit">Appointment Log</p>
          <div className="card" style={{marginBottom:20}}>
            {APPTS_TODAY.map((a,i)=>(
              <div key={i} className="eod-row">
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{a.name}</div>
                  <div style={{fontSize:11,color:C.muted}}>{a.time} · {a.service}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.green}}>${a.amount}</div>
                  <span className="badge" style={{fontSize:9,background:a.paid==="card"?`${C.blue}20`:a.paid==="cash"?`${C.green}20`:`${C.purple}20`,color:a.paid==="card"?C.blue:a.paid==="cash"?C.green:C.purple}}>{a.paid}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn bg" onClick={()=>setStep("cash")}>Next: Count Cash →</button>
        </>}

        {step==="cash"&&<>
          <div className="notify-banner">
            <span style={{fontSize:22}}>💵</span>
            <div>
              <div style={{fontSize:13,fontWeight:700}}>Cash Count</div>
              <div style={{fontSize:12,color:C.muted}}>Count your cash drawer and enter the quantities below.</div>
            </div>
          </div>

          <div className="card" style={{marginBottom:14}}>
            {denoms.map((d,i)=>(
              <div key={d.val} className="denomination-row">
                <div>
                  <div style={{fontSize:15,fontWeight:700}}>{d.label}</div>
                  <div style={{fontSize:11,color:C.muted}}>× {d.qty} = ${(d.val*d.qty).toFixed(2)}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div className="denom-qty-btn" onClick={()=>updateDenom(i,-1)}>−</div>
                  <span style={{fontSize:18,fontWeight:700,minWidth:24,textAlign:"center"}}>{d.qty}</span>
                  <div className="denom-qty-btn" onClick={()=>updateDenom(i,1)}>+</div>
                </div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0",borderTop:`1px solid ${C.border}`,marginTop:4}}>
              <span style={{fontSize:15,fontWeight:700}}>Cash Total</span>
              <span style={{fontSize:20,fontWeight:900,color:C.green,fontFamily:"'Playfair Display',serif"}}>${cashInDenoms.toFixed(2)}</span>
            </div>
          </div>

          <div className={`discrepancy-banner ${discStatus}`}>
            <span style={{fontSize:24}}>{discStatus==="ok"?"✅":discStatus==="warn"?"⚠️":"🚨"}</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:discColors[discStatus]}}>
                {discStatus==="ok"?"Cash matches perfectly!":discStatus==="warn"?`Small discrepancy: ${cashDiff>0?"+":""}$${cashDiff.toFixed(2)}`:`Discrepancy: ${cashDiff>0?"+":""}$${cashDiff.toFixed(2)}`}
              </div>
              <div style={{fontSize:12,color:C.muted}}>Expected: ${cashExpected.toFixed(2)} · Counted: ${cashInDenoms.toFixed(2)}</div>
            </div>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button className="bo" style={{flex:1,padding:"12px"}} onClick={()=>setStep("summary")}>← Back</button>
            <button className="btn bg" style={{flex:2}} onClick={()=>setStep("close")}>Next: Close Out →</button>
          </div>
        </>}

        {step==="close"&&<>
          <p className="stit">Final Notes</p>
          <div style={{marginBottom:14}}>
            <label className="lbl">End-of-day notes (optional)</label>
            <textarea className="txa" rows={3} placeholder="Anything unusual today? Equipment issues, client notes..." value={notes} onChange={e=>setNotes(e.target.value)}/>
          </div>
          <p className="stit">Checklist</p>
          <div className="card" style={{marginBottom:14}}>
            {["Counted cash drawer","Sanitized stations","Confirmed tomorrow's appointments","Turned off clippers & equipment","Locked front door","Set alarm"].map((item,i)=>{
              const [checked,setChecked]=useState(false);
              return(
                <div key={i} onClick={()=>setChecked(v=>!v)} className="eod-row" style={{cursor:"pointer"}}>
                  <span style={{fontSize:14}}>{item}</span>
                  <div style={{width:24,height:24,borderRadius:8,border:`2px solid ${checked?C.green:C.border}`,background:checked?`${C.green}20`:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:C.green,transition:"all .18s"}}>{checked?"✓":""}</div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button className="bo" style={{flex:1,padding:"12px"}} onClick={()=>setStep("cash")}>← Back</button>
            <button className="btn bg" style={{flex:2}} onClick={()=>{showToast("Day closed out!");setTimeout(()=>setStep("receipt"),600);}}>Close Out Day ✓</button>
          </div>
        </>}

        {step==="receipt"&&<>
          <div style={{textAlign:"center",padding:"24px 0 16px",animation:"screenIn .4s ease"}}>
            <div style={{fontSize:60,marginBottom:12,animation:"bounce 1s ease infinite alternate"}}>✅</div>
            <h2 className="pf" style={{fontSize:24,fontWeight:700,color:C.green,marginBottom:4}}>Day Closed!</h2>
            <p style={{fontSize:13,color:C.muted}}>Feb 20, 2026 · 7:32 PM</p>
          </div>
          <div className="cashout-hero" style={{textAlign:"left"}}>
            <p style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:12}}>📋 DAILY SUMMARY</p>
            {[["Gross Revenue","$"+systemTotal.toFixed(2)],["Total Tips","$48.00"],["Card Payments","$"+PAYMENT_METHODS_EOD.find(m=>m.id==="card").expected.toFixed(2)],["Cash Collected","$"+cashInDenoms.toFixed(2)],["Appointments","5"],["Avg Ticket","$62.00"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid rgba(76,175,122,.15)`}}>
                <span style={{fontSize:13,color:C.muted}}>{l}</span>
                <span style={{fontSize:14,fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:16}}>
            <button className="bo" style={{padding:"12px"}} onClick={()=>showToast("Report emailed!")}>📧 Email Report</button>
            <button className="btn bg" style={{padding:"12px"}} onClick={onClose}>Done</button>
          </div>
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// WALK-IN QUEUE (KIOSK MODE)
// ══════════════════════════════════════════
function WalkInKioskScreen({onClose}){
  const [mode,setMode]=useState("manager"); // manager | kiosk | ticket
  const [queue,setQueue]=useState([
    {ticket:1,name:"Walk-In #1",service:"Fade",barber:"Marcus",addedAt:"9:15 AM",status:"current",eta:"Now",avatar:"W"},
    {ticket:2,name:"DeShawn W.",service:"Shape-Up",barber:"Marcus",addedAt:"9:30 AM",status:"next",eta:"~25 min",avatar:"D"},
    {ticket:3,name:"Walk-In #3",service:"Haircut",barber:"Darius",addedAt:"10:00 AM",status:"waiting",eta:"~50 min",avatar:"W"},
    {ticket:4,name:"Walk-In #4",service:"Beard Trim",barber:"Jerome",addedAt:"10:20 AM",status:"waiting",eta:"~1 hr",avatar:"W"},
  ]);
  const [nextTicket,setNextTicket]=useState(5);
  const [kioskStep,setKioskStep]=useState("services"); // services | barber | confirm | ticket
  const [kioskSvc,setKioskSvc]=useState(null);
  const [kioskBarber,setKioskBarber]=useState(null);
  const [kioskName,setKioskName]=useState("");
  const [newTicketNum,setNewTicketNum]=useState(null);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const callNext=()=>{
    setQueue(q=>{
      const updated=[...q];
      const currentIdx=updated.findIndex(c=>c.status==="current");
      if(currentIdx>=0) updated.splice(currentIdx,1);
      if(updated.length>0) updated[0]={...updated[0],status:"current",eta:"Now"};
      if(updated.length>1) updated[1]={...updated[1],status:"next"};
      return updated;
    });
    showToast("Called next client!");
  };

  const addWalkIn=()=>{
    const num=nextTicket;
    setNextTicket(n=>n+1);
    const newEntry={ticket:num,name:kioskName||`Walk-In #${num}`,service:kioskSvc,barber:kioskBarber||"Any",addedAt:"Now",status:"waiting",eta:`~${(queue.length)*25} min`,avatar:kioskName?kioskName[0].toUpperCase():"W"};
    setQueue(q=>[...q,newEntry]);
    setNewTicketNum(num);
    setKioskStep("ticket");
  };

  const removeFromQueue=ticket=>{setQueue(q=>q.filter(c=>c.ticket!==ticket));showToast("Removed from queue");};

  const KIOSK_SVCS=["Fade","Shape-Up","Haircut","Beard Trim","Braids","Color","Kid's Cut"];
  const KIOSK_BARBERS=[{name:"Marcus J.",avatar:"M",color:C.gold,status:"Available in ~20 min"},{name:"Darius B.",avatar:"D",color:C.blue,status:"Available now"},{name:"Jerome W.",avatar:"J",color:C.green,status:"Available in ~45 min"}];

  // ── KIOSK VIEW ──
  if(mode==="kiosk"){
    return(
      <div className="kiosk-wrap">
        {/* Back to manager */}
        <div style={{position:"absolute",top:16,right:16,zIndex:10}}>
          <button onClick={()=>{setMode("manager");setKioskStep("services");setKioskSvc(null);setKioskBarber(null);setKioskName("");}} style={{background:"transparent",border:`1px solid ${C.dim}`,color:C.dim,borderRadius:10,padding:"6px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✕ Exit Kiosk</button>
        </div>

        {kioskStep==="services"&&(
          <div style={{padding:"0 0 40px"}}>
            <div className="kiosk-hero">
              <div style={{fontSize:48,marginBottom:12}}>✂️</div>
              <h1 className="pf" style={{fontSize:28,fontWeight:700,color:C.gold,marginBottom:8}}>Welcome to Chop-It-Up</h1>
              <p style={{fontSize:15,color:C.muted}}>Tap a service to join the walk-in queue</p>
            </div>
            <div style={{padding:"0 20px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <p className="stit" style={{margin:0}}>SELECT SERVICE</p>
                <span style={{fontSize:13,color:C.muted}}>{queue.length} in queue</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {KIOSK_SVCS.map(svc=>{
                  const s=SVCS_INIT.find(s=>s.name===svc)||{price:30,duration:45,icon:"✂️"};
                  return(
                    <div key={svc} className="kiosk-barber-card" style={{padding:"20px 16px"}} onClick={()=>{setKioskSvc(svc);setKioskStep("barber");}}>
                      <div style={{fontSize:32,marginBottom:8}}>{s.icon||"✂️"}</div>
                      <div style={{fontSize:16,fontWeight:700}}>{svc}</div>
                      <div style={{fontSize:13,color:C.muted,marginTop:4}}>${s.price} · {s.duration}min</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {kioskStep==="barber"&&(
          <div style={{padding:"20px 20px 40px"}}>
            <div style={{textAlign:"center",marginBottom:24,paddingTop:40}}>
              <div style={{fontSize:13,color:C.gold,fontWeight:700,marginBottom:4}}>SERVICE SELECTED</div>
              <div style={{fontSize:24,fontWeight:800}}>{kioskSvc}</div>
            </div>
            <p className="stit" style={{textAlign:"center"}}>CHOOSE YOUR BARBER (OPTIONAL)</p>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
              {[{name:"No Preference",avatar:"?",color:C.muted,status:"Next available barber"},...KIOSK_BARBERS].map(b=>(
                <div key={b.name} className={`kiosk-barber-card${kioskBarber===b.name?" sel":""}`} style={{display:"flex",alignItems:"center",gap:14,padding:"16px",textAlign:"left"}} onClick={()=>setKioskBarber(b.name==="No Preference"?null:b.name)}>
                  <div className="pav" style={{width:48,height:48,fontSize:18,background:`linear-gradient(135deg,${b.color},${b.color}88)`,flexShrink:0}}>{b.avatar}</div>
                  <div>
                    <div style={{fontSize:16,fontWeight:700}}>{b.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>{b.status}</div>
                  </div>
                  {kioskBarber===(b.name==="No Preference"?null:b.name)&&<span style={{marginLeft:"auto",color:C.gold,fontSize:24}}>✓</span>}
                </div>
              ))}
            </div>
            <div style={{marginBottom:14}}>
              <label className="lbl">Your name (optional)</label>
              <input className="inp" style={{fontSize:16,padding:"14px 16px"}} placeholder="First name" value={kioskName} onChange={e=>setKioskName(e.target.value)}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="bo" style={{flex:1,padding:"14px"}} onClick={()=>setKioskStep("services")}>← Back</button>
              <button className="btn bg" style={{flex:2,fontSize:16}} onClick={addWalkIn}>Join Queue →</button>
            </div>
          </div>
        )}

        {kioskStep==="ticket"&&(
          <div style={{padding:"40px 20px",display:"flex",flexDirection:"column",alignItems:"center",minHeight:"100vh",justifyContent:"center"}}>
            <div style={{fontSize:40,marginBottom:16,animation:"bounce 1s ease infinite alternate"}}>🎫</div>
            <div className="kiosk-ticket" style={{width:"100%"}}>
              <div style={{fontSize:13,color:C.muted,marginBottom:8,letterSpacing:1.5}}>YOUR TICKET NUMBER</div>
              <div className="kiosk-ticket-num">{String(newTicketNum).padStart(2,"0")}</div>
              <div style={{fontSize:16,fontWeight:700,marginTop:16,color:C.text}}>{kioskSvc}</div>
              {kioskBarber&&<div style={{fontSize:13,color:C.muted,marginTop:4}}>with {kioskBarber}</div>}
              <div style={{marginTop:16,padding:"10px 20px",background:`${C.gold}15`,borderRadius:10,display:"inline-block"}}>
                <span style={{fontSize:13,color:C.gold,fontWeight:700}}>~{(queue.length-1)*25} min wait</span>
              </div>
            </div>
            <p style={{fontSize:13,color:C.muted,textAlign:"center",marginTop:16,lineHeight:1.6}}>We'll call your number when it's your turn. Feel free to relax!</p>
            <button className="btn bg" style={{marginTop:20,padding:"14px 40px",fontSize:16}} onClick={()=>{setKioskStep("services");setKioskSvc(null);setKioskBarber(null);setKioskName("");}}>Done</button>
          </div>
        )}
      </div>
    );
  }

  // ── MANAGER VIEW ──
  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Walk-In Queue</h2>
          <button onClick={()=>{setMode("kiosk");setKioskStep("services");}} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:`${C.gold}15`,border:`1px solid ${C.gold}40`,borderRadius:10,color:C.gold,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>📟 Kiosk Mode</button>
        </div>
        {/* Stats */}
        <div style={{display:"flex",gap:10}}>
          {[{label:"In Queue",val:queue.length,color:C.blue},{label:"Avg Wait",val:`${queue.length*20}m`,color:C.orange},{label:"Served Today",val:"7",color:C.green}].map(({label,val,color})=>(
            <div key={label} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color}}>{val}</div>
              <div style={{fontSize:10,color:C.muted}}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:14,paddingBottom:100}}>
        {/* Current */}
        {queue.filter(c=>c.status==="current").map(c=>(
          <div key={c.ticket} className="kiosk-queue-row current" style={{marginBottom:12}}>
            <div style={{position:"absolute",top:0,left:0,bottom:0,width:4,background:C.green,borderRadius:"14px 0 0 14px"}}/>
            <div className="kiosk-num" style={{background:`${C.green}20`,color:C.green}}>#{c.ticket}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                <span style={{fontSize:15,fontWeight:700}}>{c.name}</span>
                <span className="badge bgrn" style={{fontSize:9}}>NOW</span>
              </div>
              <div style={{fontSize:12,color:C.muted}}>{c.service} · with {c.barber}</div>
            </div>
            <button className="btn bg" style={{fontSize:12,padding:"8px 14px"}} onClick={callNext}>Done → Call Next</button>
          </div>
        ))}

        {/* Queue */}
        <p className="stit">Waiting ({queue.filter(c=>c.status!=="current").length})</p>
        {queue.filter(c=>c.status!=="current").map((c,i)=>(
          <div key={c.ticket} className={`kiosk-queue-row${c.status==="next"?" next-up":""}`}>
            {c.status==="next"&&<div style={{position:"absolute",top:0,left:0,bottom:0,width:4,background:C.gold,borderRadius:"14px 0 0 14px"}}/>}
            <div className="kiosk-num" style={{background:c.status==="next"?`${C.gold}20`:C.surface,color:c.status==="next"?C.gold:C.muted}}>#{c.ticket}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:2}}>{c.name}</div>
              <div style={{fontSize:12,color:C.muted}}>{c.service} · {c.barber} · {c.eta}</div>
              <div style={{fontSize:11,color:C.dim}}>Added {c.addedAt}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
              {c.status==="next"&&<span className="badge bgold" style={{fontSize:9}}>UP NEXT</span>}
              <button onClick={()=>removeFromQueue(c.ticket)} style={{background:"transparent",border:"none",color:C.dim,fontSize:18,cursor:"pointer",padding:"2px",lineHeight:1}}>✕</button>
            </div>
          </div>
        ))}

        {queue.length===0&&(
          <div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>
            <div style={{fontSize:48,marginBottom:12}}>🎉</div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>Queue is empty!</div>
            <div style={{fontSize:13}}>Switch to Kiosk Mode for walk-ins to self-check-in.</div>
          </div>
        )}

        {/* Add manually */}
        <button className="btn bg" style={{width:"100%",marginTop:16}} onClick={()=>{setKioskSvc("Fade");setKioskBarber(null);setKioskName("");setMode("kiosk");setKioskStep("services");}}>+ Add Walk-In</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// PHOTO PORTFOLIO PER BARBER
// ══════════════════════════════════════════
function PortfolioScreen({onClose}){
  const [photos,setPhotos]=useState(PORTFOLIO_PHOTOS);
  const [selBarber,setSelBarber]=useState("All");
  const [selTag,setSelTag]=useState("All");
  const [selPhoto,setSelPhoto]=useState(null);
  const [uploadModal,setUploadModal]=useState(false);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const BARBERS_LIST=[
    {name:"All",avatar:"✂️",color:C.gold},
    {name:"Marcus",avatar:"M",color:C.gold},
    {name:"Darius",avatar:"D",color:C.blue},
    {name:"Jerome",avatar:"J",color:C.green},
  ];
  const ALL_TAGS=["All","Fade","Shape-Up","Beard","Braids","Color","Classic","Style","Edge"];
  const PHOTO_EMOJIS={fade:"✂️",beard:"🧔",braids:"〰️",color:"🎨","shape-up":"📐",default:"💈"};

  const filtered=photos.filter(p=>(selBarber==="All"||p.barber===selBarber)&&(selTag==="All"||p.tags.includes(selTag)));

  const handleDelete=id=>{setPhotos(p=>p.filter(ph=>ph.id!==id));setSelPhoto(null);showToast("Photo removed");};
  const handleLike=id=>{setPhotos(p=>p.map(ph=>ph.id===id?{...ph,likes:ph.likes+1}:ph));};

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Portfolio</h2>
          <button className="bgh" onClick={()=>setUploadModal(true)}>+ Add</button>
        </div>

        {/* Barber selector */}
        <div style={{display:"flex",gap:14,overflowX:"auto",scrollbarWidth:"none",paddingBottom:4,marginBottom:12}}>
          {BARBERS_LIST.map(b=>{
            const count=b.name==="All"?photos.length:photos.filter(p=>p.barber===b.name).length;
            return(
              <div key={b.name} className={`barber-portfolio-tab${selBarber===b.name?" sel":""}`} onClick={()=>setSelBarber(b.name)}>
                <div className="bp-avatar" style={{background:`linear-gradient(135deg,${b.color},${b.color}88)`,color:b.name==="All"?"white":"#0D0D0D",fontSize:b.name==="All"?16:18,fontWeight:700}}>
                  {b.avatar}
                </div>
                <span style={{fontSize:10,fontWeight:600,color:selBarber===b.name?C.gold:C.muted}}>{b.name}</span>
                <span style={{fontSize:9,color:C.dim}}>{count} pics</span>
              </div>
            );
          })}
        </div>

        {/* Tag filter */}
        <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",paddingBottom:4}}>
          {ALL_TAGS.map(t=><span key={t} className={`photo-tag${selTag===t?" sel":""}`} onClick={()=>setSelTag(t)}>{t}</span>)}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{padding:"0 20px 12px",display:"flex",gap:10}}>
        {[{label:"Photos",val:filtered.length},{label:"Total Likes",val:filtered.reduce((a,p)=>a+p.likes,0)},{label:"Top Style",val:"Fade"}].map(({label,val})=>(
          <div key={label} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:C.gold}}>{val}</div>
            <div style={{fontSize:9,color:C.muted}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Photo grid */}
      <div className="sec" style={{padding:"0",marginTop:0}}>
        {filtered.length>0?(
          <div className="portfolio-grid">
            {filtered.map(ph=>(
              <div key={ph.id} className="portfolio-item" onClick={()=>setSelPhoto(ph)}>
                <div className="portfolio-item-emoji">{PHOTO_EMOJIS[ph.type]||"💈"}</div>
                <div style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,.7)",borderRadius:8,padding:"2px 6px",fontSize:10,color:"white",display:"flex",alignItems:"center",gap:3}}>❤️ {ph.likes}</div>
                <div style={{position:"absolute",top:6,left:6,background:"rgba(0,0,0,.7)",borderRadius:8,padding:"2px 6px",fontSize:9,color:"white",fontWeight:700}}>{ph.barber}</div>
              </div>
            ))}
          </div>
        ):(
          <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
            <div style={{fontSize:48,marginBottom:12}}>📷</div>
            <div style={{fontSize:15,fontWeight:700,color:C.text}}>No photos yet</div>
            <div style={{fontSize:12,marginTop:4}}>Add before/after shots to build your portfolio.</div>
          </div>
        )}
      </div>

      {/* Photo detail overlay */}
      {selPhoto&&(
        <div className="portfolio-photo-full">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexShrink:0}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setSelPhoto(null)}>← Back</button>
            <span style={{fontSize:13,fontWeight:600,color:C.muted}}>{selPhoto.barber} · {selPhoto.date}</span>
            <button onClick={()=>handleDelete(selPhoto.id)} style={{background:"transparent",border:"none",color:C.red,fontSize:20,cursor:"pointer",padding:"4px"}}>🗑</button>
          </div>

          {/* Photo display */}
          <div style={{background:C.card,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,height:240,marginBottom:14,fontSize:80,position:"relative",overflow:"hidden"}}>
            {PHOTO_EMOJIS[selPhoto.type]||"💈"}
            <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.8),transparent)",display:"flex",alignItems:"flex-end",padding:16}}>
              <div>
                {selPhoto.tags.map(t=><span key={t} className="badge bblu" style={{marginRight:4,fontSize:10}}>{t}</span>)}
              </div>
            </div>
          </div>

          <div style={{flex:1,overflowY:"auto",paddingBottom:20}}>
            <p style={{fontSize:15,fontWeight:700,marginBottom:8}}>{selPhoto.caption}</p>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{display:"flex",gap:12}}>
                <button onClick={()=>{handleLike(selPhoto.id);setSelPhoto(p=>({...p,likes:p.likes+1}));}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",color:C.text,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:6,fontSize:13}}>❤️ {selPhoto.likes}</button>
                <button onClick={()=>showToast("Shared to Instagram!")} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",color:C.text,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13}}>📤 Share</button>
              </div>
              <button onClick={()=>showToast("Posted to Social!")} className="bgh" style={{fontSize:12}}>📱 Post to Social</button>
            </div>

            {/* Before/after section */}
            <p className="stit">Before / After</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {["Before","After"].map(label=>(
                <div key={label} className="ba-panel">
                  <div style={{fontSize:44,marginBottom:8}}>{label==="Before"?"😐":PHOTO_EMOJIS[selPhoto.type]||"💈"}</div>
                  <div style={{position:"absolute",top:8,left:8,background:"rgba(0,0,0,.6)",borderRadius:8,padding:"3px 8px",fontSize:10,color:"white",fontWeight:700}}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload / add photo modal */}
      {uploadModal&&(
        <div className="ov" onClick={()=>setUploadModal(false)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <div className="mh"/>
            <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:14}}>Add Photo</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {[{icon:"📷",label:"Take Photo",sub:"Camera"},{icon:"🖼",label:"From Library",sub:"Gallery"},{icon:"📤",label:"Import",sub:"Google Drive"},{icon:"🔗",label:"From Social",sub:"Instagram"}].map(({icon,label,sub})=>(
                <button key={label} className="bo" style={{padding:"20px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,borderRadius:16}} onClick={()=>{showToast(`${label} — opened!`);setUploadModal(false);}}>
                  <span style={{fontSize:32}}>{icon}</span>
                  <span style={{fontSize:13,fontWeight:700}}>{label}</span>
                  <span style={{fontSize:11,color:C.muted}}>{sub}</span>
                </button>
              ))}
            </div>
            <div style={{marginBottom:12}}>
              <label className="lbl">Assign to barber</label>
              <select className="sel">
                {["Marcus J.","Darius B.","Jerome W."].map(b=><option key={b}>{b}</option>)}
              </select>
            </div>
            <div style={{marginBottom:14}}>
              <label className="lbl">Style tags</label>
              <div style={{display:"flex",flexWrap:"wrap"}}>
                {["Fade","Shape-Up","Beard","Braids","Color"].map(t=><span key={t} className="photo-tag" onClick={e=>{e.currentTarget.classList.toggle("sel")}}>{t}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// ══════════════════════════════════════════
// STAFF PAYROLL & COMMISSION TRACKING
// ══════════════════════════════════════════
function PayrollScreen({onClose}){
  const [barbers]=useState(PAYROLL_BARBERS);
  const [tab,setTab]=useState("overview");
  const [selBarber,setSelBarber]=useState(null);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const totalPayroll=barbers.reduce((a,b)=>a+b.netPay,0);
  const pending=barbers.filter(b=>b.status==="pending");

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Payroll</h2>
          <button className="bgh" onClick={()=>showToast("Export sent!")}>Export</button>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {["overview","stubs","history"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="overview"&&<>
          {/* Summary hero */}
          <div style={{background:`linear-gradient(135deg,rgba(201,168,76,.14),rgba(201,168,76,.04))`,border:`1px solid rgba(201,168,76,.3)`,borderRadius:18,padding:20,marginBottom:16}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:4}}>Feb 1–15 · Total Payroll</div>
            <div style={{fontSize:40,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.gold,lineHeight:1}}>${totalPayroll.toLocaleString()}</div>
            <div style={{display:"flex",gap:16,marginTop:12}}>
              <div><div style={{fontSize:16,fontWeight:800}}>{pending.length}</div><div style={{fontSize:10,color:C.muted}}>Pending</div></div>
              <div><div style={{fontSize:16,fontWeight:800,color:C.green}}>1</div><div style={{fontSize:10,color:C.muted}}>Paid</div></div>
              <div><div style={{fontSize:16,fontWeight:800}}>{barbers.reduce((a,b)=>a+b.services,0)}</div><div style={{fontSize:10,color:C.muted}}>Services</div></div>
              <div><div style={{fontSize:16,fontWeight:800,color:C.green}}>${barbers.reduce((a,b)=>a+b.tips,0)}</div><div style={{fontSize:10,color:C.muted}}>Total Tips</div></div>
            </div>
          </div>

          <p className="stit">Barbers</p>
          {barbers.map(b=>{
            const gross=b.revenue*(b.commissionRate/100)+b.tips-b.expenses;
            const pct=Math.round((b.revenue/barbers[0].revenue)*100);
            return(
              <div key={b.id} className={`payroll-barber-card${selBarber?.id===b.id?" sel":""}`} onClick={()=>setSelBarber(b.id===selBarber?.id?null:b)}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <div className="pav" style={{width:44,height:44,fontSize:17,background:`linear-gradient(135deg,${b.color},${b.color}88)`}}>{b.avatar}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:15,fontWeight:700}}>{b.name}</span>
                      <span className={`badge ${b.status==="paid"?"bgrn":"borg"}`} style={{fontSize:9}}>{b.status==="paid"?"✓ Paid":"Pending"}</span>
                    </div>
                    <div style={{fontSize:12,color:C.muted}}>{b.role} · {b.commissionRate}% commission</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:800,color:C.gold}}>${b.netPay.toLocaleString()}</div>
                    <div style={{fontSize:10,color:C.muted}}>net pay</div>
                  </div>
                </div>
                <div className="commission-bar">
                  <div className="commission-fill" style={{width:`${pct}%`,background:`linear-gradient(90deg,${b.color},${b.color}88)`}}/>
                </div>
                {selBarber?.id===b.id&&(
                  <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                    {[["Gross Revenue","$"+b.revenue.toLocaleString()],["Commission ("+b.commissionRate+"%)","$"+Math.round(b.revenue*b.commissionRate/100).toLocaleString()],["Tips Earned","$"+b.tips],["Expenses / Deductions",b.expenses?"−$"+b.expenses:"$0"],["Net Pay","$"+b.netPay.toLocaleString()]].map(([l,v],i,arr)=>(
                      <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
                        <span style={{fontSize:13,color:C.muted}}>{l}</span>
                        <span style={{fontSize:14,fontWeight:i===arr.length-1?800:600,color:i===arr.length-1?C.gold:C.text}}>{v}</span>
                      </div>
                    ))}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
                      <button className="bo" style={{padding:"10px",fontSize:13}} onClick={()=>showToast("Pay stub generated!")}>📄 Pay Stub</button>
                      <button className="btn bg" style={{fontSize:13}} onClick={()=>showToast(`${b.name} marked as paid!`)}>Mark Paid ✓</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {pending.length>0&&(
            <button className="btn bg" style={{width:"100%",marginTop:8}} onClick={()=>showToast("Paying all pending staff...")}>
              💸 Pay All Pending (${pending.reduce((a,b)=>a+b.netPay,0).toLocaleString()})
            </button>
          )}
        </>}

        {tab==="stubs"&&<>
          <p className="stit">Pay Stubs — Feb 1–15</p>
          {barbers.map(b=>(
            <div key={b.id} className={`pay-stub ${b.status}`}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div className="pav" style={{width:38,height:38,fontSize:15,background:`linear-gradient(135deg,${b.color},${b.color}88)`}}>{b.avatar}</div>
                  <div>
                    <div style={{fontSize:14,fontWeight:700}}>{b.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>{b.payPeriod}</div>
                  </div>
                </div>
                <span className={`badge ${b.status==="paid"?"bgrn":"borg"}`}>{b.status==="paid"?"✓ Paid":"Pending"}</span>
              </div>
              {[["Services",b.services],["Gross Revenue","$"+b.revenue.toLocaleString()],["Commission","$"+Math.round(b.revenue*b.commissionRate/100).toLocaleString()],["Tips","$"+b.tips],["Net Pay","$"+b.netPay.toLocaleString()]].map(([l,v],i,arr)=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none",fontWeight:i===arr.length-1?700:400}}>
                  <span style={{fontSize:13,color:i===arr.length-1?C.text:C.muted}}>{l}</span>
                  <span style={{fontSize:13,color:i===arr.length-1?C.gold:C.text}}>{v}</span>
                </div>
              ))}
              <button className="bo" style={{width:"100%",marginTop:12,padding:"9px",fontSize:12}} onClick={()=>showToast("PDF generated!")}>📤 Download PDF</button>
            </div>
          ))}
        </>}

        {tab==="history"&&<>
          <p className="stit">Previous Pay Periods</p>
          {PAY_HISTORY.map(p=>(
            <div key={p.period} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:`1px solid ${C.border}`}}>
              <div>
                <div style={{fontSize:14,fontWeight:700}}>{p.period}</div>
                <div style={{fontSize:12,color:C.muted}}>Paid {p.date}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:16,fontWeight:800,color:C.green}}>${p.total.toLocaleString()}</span>
                <button className="bgh" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>showToast("Report downloaded!")}>↓</button>
              </div>
            </div>
          ))}
          <div style={{background:C.card,borderRadius:14,padding:16,marginTop:14,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>YTD Summary — 2026</div>
            {[["Total Payroll","$11,660"],["Total Revenue","$21,200"],["Avg Commission Rate","67%"],["Total Tips Distributed","$1,132"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{l}</span>
                <span style={{fontSize:13,fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// TIP SPLITTING & POOLING
// ══════════════════════════════════════════
function TipSplittingScreen({onClose}){
  const [method,setMethod]=useState("individual"); // individual | pool | custom
  const [tips,setTips]=useState(TIPS_TODAY);
  const [customSplits,setCustomSplits]=useState({Marcus:50,Darius:30,Jerome:20});
  const [tab,setTab]=useState("today");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const totalTips=tips.reduce((a,b)=>a+b.total,0);
  const pooled=totalTips/tips.length;

  const getSplit=(barber)=>{
    if(method==="individual") return tips.find(t=>t.barber===barber)?.total||0;
    if(method==="pool") return Math.round(pooled*100)/100;
    return Math.round(totalTips*(customSplits[barber]/100)*100)/100;
  };

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Tip Splitting</h2>
          <div style={{width:60}}/>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {["today","week","settings"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="today"&&<>
          {/* Total tips hero */}
          <div className="tip-card" style={{background:`linear-gradient(135deg,rgba(76,175,122,.14),rgba(76,175,122,.04))`,border:`1px solid rgba(76,175,122,.3)`,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:2}}>Today's Total Tips</div>
                <div style={{fontSize:40,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.green}}>${totalTips}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:C.muted}}>Cash</div>
                <div style={{fontSize:18,fontWeight:800}}>${tips.reduce((a,b)=>a+b.cash,0)}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>Card</div>
                <div style={{fontSize:18,fontWeight:800,color:C.blue}}>${tips.reduce((a,b)=>a+b.card,0)}</div>
              </div>
            </div>
          </div>

          {/* Method selector */}
          <p className="stit">Split Method</p>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {[{id:"individual",label:"Keep Own",icon:"👤"},{id:"pool",label:"Equal Pool",icon:"🤝"},{id:"custom",label:"Custom %",icon:"⚙️"}].map(m=>(
              <div key={m.id} className={`tip-method-btn${method===m.id?" sel":""}`} onClick={()=>setMethod(m.id)}>
                <div style={{fontSize:18,marginBottom:4}}>{m.icon}</div>
                <div style={{fontSize:11}}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Custom sliders */}
          {method==="custom"&&(
            <div className="tip-card" style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Custom Split Percentages</div>
              {Object.entries(customSplits).map(([name,pct])=>(
                <div key={name} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600}}>{name}</span>
                    <span style={{fontSize:13,fontWeight:700,color:C.gold}}>{pct}%</span>
                  </div>
                  <input type="range" className="split-slider" min={0} max={100} value={pct} onChange={e=>{
                    const val=Number(e.target.value);
                    setCustomSplits(s=>({...s,[name]:val}));
                  }}/>
                </div>
              ))}
              <div style={{textAlign:"center",fontSize:12,color:Object.values(customSplits).reduce((a,b)=>a+b,0)===100?C.green:C.red,fontWeight:700}}>
                Total: {Object.values(customSplits).reduce((a,b)=>a+b,0)}% {Object.values(customSplits).reduce((a,b)=>a+b,0)===100?"✓":"(must equal 100%)"}
              </div>
            </div>
          )}

          {/* Per-barber breakdown */}
          <p className="stit">Breakdown</p>
          {tips.map(b=>(
            <div key={b.barber} className="tip-barber-row">
              <div className="pav" style={{width:40,height:40,fontSize:15,background:`linear-gradient(135deg,${b.color},${b.color}88)`,flexShrink:0}}>{b.barber[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700}}>{b.barber}</div>
                <div style={{fontSize:12,color:C.muted}}>{b.services} services · Cash ${b.cash} · Card ${b.card}</div>
              </div>
              <div className="tip-amount-pill">${getSplit(b.barber).toFixed(2)}</div>
            </div>
          ))}

          <button className="btn bg" style={{width:"100%",marginTop:16}} onClick={()=>showToast("Tips distributed & recorded!")}>
            Distribute Tips 💸
          </button>
        </>}

        {tab==="week"&&<>
          <p className="stit">This Week</p>
          <div className="tip-card" style={{marginBottom:16}}>
            {TIP_HISTORY_WEEK.map(d=>(
              <div key={d.day} className="tip-history-row">
                <span style={{fontSize:14,fontWeight:700,width:36}}>{d.day}</span>
                <div style={{flex:1,display:"flex",gap:6,alignItems:"center"}}>
                  {[{n:"Marcus",v:d.marcus,c:C.gold},{n:"Darius",v:d.darius,c:C.blue},{n:"Jerome",v:d.jerome,c:C.green}].map(({n,v,c})=>(
                    <div key={n} style={{flex:1,textAlign:"center"}}>
                      <div style={{fontSize:12,fontWeight:700,color:c}}>${v}</div>
                      <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden",marginTop:3}}>
                        <div style={{height:"100%",width:`${(v/70)*100}%`,background:c,borderRadius:2}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <span style={{fontSize:14,fontWeight:800,color:C.text,marginLeft:8}}>${d.marcus+d.darius+d.jerome}</span>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {tips.map(b=>{
              const weekTotal=TIP_HISTORY_WEEK.reduce((a,d)=>a+(d[b.barber.toLowerCase()]||0),0)+b.total;
              return(
                <div key={b.barber} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,textAlign:"center"}}>
                  <div className="pav" style={{width:36,height:36,fontSize:14,background:`linear-gradient(135deg,${b.color},${b.color}88)`,margin:"0 auto 8px"}}>{b.barber[0]}</div>
                  <div style={{fontSize:18,fontWeight:800,color:C.green}}>${weekTotal}</div>
                  <div style={{fontSize:10,color:C.muted}}>{b.barber} week</div>
                </div>
              );
            })}
          </div>
        </>}

        {tab==="settings"&&<>
          <p className="stit">Tip Settings</p>
          <div className="card" style={{marginBottom:14}}>
            {[{l:"Show tip screen at checkout",s:"Prompt clients for tip amount",on:true},{l:"Suggested tip amounts",s:"Show 15%, 20%, 25% buttons",on:true},{l:"Auto-distribute at day end",s:"Split tips when closing out",on:false},{l:"Track cash tips",s:"Manually enter cash amounts",on:true}].map(({l,s,on})=>(
              <div key={l} className="trow">
                <div><div style={{fontSize:14,fontWeight:600}}>{l}</div><div style={{fontSize:12,color:C.muted}}>{s}</div></div>
                <Tog on={on} toggle={()=>showToast("Updated")}/>
              </div>
            ))}
          </div>
          <p className="stit">Default Split Method</p>
          <div style={{display:"flex",gap:8}}>
            {[{id:"individual",label:"Individual"},{id:"pool",label:"Pool"},{id:"custom",label:"Custom"}].map(m=>(
              <div key={m.id} className={`tip-method-btn${method===m.id?" sel":""}`} onClick={()=>{setMethod(m.id);showToast("Default updated")}}>{m.label}</div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// TAX & EXPENSE TRACKER
// ══════════════════════════════════════════
function TaxExpenseScreen({onClose}){
  const [expenses,setExpenses]=useState(EXPENSES_INIT);
  const [tab,setTab]=useState("expenses");
  const [selCat,setSelCat]=useState("All");
  const [addModal,setAddModal]=useState(false);
  const [form,setForm]=useState({desc:"",category:"Supplies",amount:"",deductible:true});
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const shown=selCat==="All"?expenses:expenses.filter(e=>e.category===selCat);
  const totalShown=shown.reduce((a,e)=>a+e.amount,0);
  const deductible=expenses.filter(e=>e.deductible).reduce((a,e)=>a+e.amount,0);

  const CAT_COLORS={Equipment:C.blue,Supplies:C.green,Rent:C.orange,Marketing:C.pink,Insurance:C.purple,Meals:C.gold,Other:C.muted};

  const addExpense=()=>{
    if(!form.desc||!form.amount)return;
    setExpenses(e=>[{id:Date.now(),desc:form.desc,category:form.category,amount:Number(form.amount),date:"Today",icon:"📋",deductible:form.deductible,receipt:false},...e]);
    showToast("Expense added!");
    setAddModal(false);
    setForm({desc:"",category:"Supplies",amount:"",deductible:true});
  };

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Tax & Expenses</h2>
          <button className="bgh" onClick={()=>setAddModal(true)}>+ Add</button>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {["expenses","quarterly","mileage"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="expenses"&&<>
          {/* Summary */}
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[{l:"YTD Expenses",v:"$"+expenses.reduce((a,e)=>a+e.amount,0).toFixed(0),c:C.red},{l:"Deductible",v:"$"+deductible.toFixed(0),c:C.green},{l:"No Receipt",v:expenses.filter(e=>!e.receipt).length+" items",c:C.orange}].map(({l,v,c})=>(
              <div key={l} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
                <div style={{fontSize:9,color:C.muted,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>

          {/* Category filter */}
          <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",marginBottom:14,paddingBottom:4}}>
            {TAX_CATEGORIES.map(c=>(
              <div key={c} className={`category-pill${selCat===c?" sel":""}`} style={{background:selCat===c?`${CAT_COLORS[c]||C.gold}20`:C.card,color:selCat===c?CAT_COLORS[c]||C.gold:C.muted,border:`1px solid ${selCat===c?CAT_COLORS[c]||C.gold:C.border}`}} onClick={()=>setSelCat(c)}>{c}</div>
            ))}
          </div>

          {selCat!=="All"&&<div style={{fontSize:13,color:C.muted,marginBottom:10}}>Showing {shown.length} items · Total: <span style={{color:C.text,fontWeight:700}}>${totalShown.toFixed(2)}</span></div>}

          {shown.map(e=>(
            <div key={e.id} className="expense-card" onClick={()=>showToast("Expense detail opened")}>
              <div className="expense-icon-wrap" style={{background:`${CAT_COLORS[e.category]||C.gold}18`,border:`1px solid ${CAT_COLORS[e.category]||C.gold}33`}}>{e.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
                <div style={{display:"flex",gap:6,alignItems:"center",marginTop:3}}>
                  <span className="badge" style={{fontSize:9,background:`${CAT_COLORS[e.category]||C.gold}18`,color:CAT_COLORS[e.category]||C.gold,border:`1px solid ${CAT_COLORS[e.category]||C.gold}33`}}>{e.category}</span>
                  <span style={{fontSize:11,color:C.dim}}>{e.date}</span>
                  {e.deductible&&<span className="badge bgrn" style={{fontSize:9}}>Deductible</span>}
                  {!e.receipt&&<span className="badge borg" style={{fontSize:9}}>No Receipt</span>}
                </div>
              </div>
              <span style={{fontSize:16,fontWeight:800,color:C.red,flexShrink:0}}>−${e.amount.toFixed(2)}</span>
            </div>
          ))}
        </>}

        {tab==="quarterly"&&<>
          <div className="tax-estimate-card">
            <div style={{fontSize:12,color:C.muted,marginBottom:4}}>Q1 2026 Estimated Tax</div>
            <div style={{fontSize:42,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.red,lineHeight:1}}>${QUARTERLY_EST[0].tax.toLocaleString()}</div>
            <div style={{fontSize:13,color:C.muted,marginTop:6}}>Due <strong style={{color:C.text}}>{QUARTERLY_EST[0].due}</strong> · {Math.ceil((new Date("2026-04-15")-new Date())/86400000)} days away</div>
            <div style={{display:"flex",gap:16,marginTop:14}}>
              <div><div style={{fontSize:15,fontWeight:800,color:C.green}}>${QUARTERLY_EST[0].income.toLocaleString()}</div><div style={{fontSize:10,color:C.muted}}>Gross Income</div></div>
              <div><div style={{fontSize:15,fontWeight:800,color:C.red}}>${QUARTERLY_EST[0].expenses.toLocaleString()}</div><div style={{fontSize:10,color:C.muted}}>Deductions</div></div>
              <div><div style={{fontSize:15,fontWeight:800}}>${QUARTERLY_EST[0].profit.toLocaleString()}</div><div style={{fontSize:10,color:C.muted}}>Net Profit</div></div>
            </div>
          </div>

          <p className="stit">All Quarters</p>
          {QUARTERLY_EST.map(q=>(
            <div key={q.q} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700}}>{q.q}</div>
                  <div style={{fontSize:12,color:C.muted}}>Due {q.due}</div>
                </div>
                <span className={`badge ${q.status==="paid"?"bgrn":q.status==="upcoming"?"borg":"bblu"}`}>{q.status}</span>
              </div>
              {[["Revenue","$"+q.income.toLocaleString()],["Deductions","−$"+q.expenses.toLocaleString()],["Net Profit","$"+q.profit.toLocaleString()],["Est. Tax","$"+q.tax.toLocaleString()]].map(([l,v],i,arr)=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
                  <span style={{fontSize:13,color:C.muted}}>{l}</span>
                  <span style={{fontSize:13,fontWeight:i===arr.length-1?800:600,color:i===arr.length-1?C.red:C.text}}>{v}</span>
                </div>
              ))}
              {q.status==="upcoming"&&<button className="btn bg" style={{width:"100%",marginTop:12,fontSize:13}} onClick={()=>showToast("Payment portal opened!")}>Pay Estimated Tax</button>}
            </div>
          ))}
          <div style={{background:C.card,borderRadius:12,padding:14,border:`1px solid ${C.border}`,marginTop:4}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:6}}>⚠️ Disclaimer</div>
            <div style={{fontSize:11,color:C.dim,lineHeight:1.6}}>These are estimates only. Consult a licensed CPA or tax professional for accurate tax advice. Chop-It-Up is not a tax advisor.</div>
          </div>
        </>}

        {tab==="mileage"&&<>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:20,marginBottom:16}}>
            <div style={{fontSize:13,color:C.gold,fontWeight:700,marginBottom:8}}>🚗 Mileage Tracker</div>
            <div style={{fontSize:36,fontWeight:900,fontFamily:"'Playfair Display',serif",marginBottom:4}}>284 mi</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>YTD business miles · Est. deduction: <strong style={{color:C.green}}>$166.22</strong></div>
            <button className="btn bg" style={{fontSize:13}} onClick={()=>showToast("Trip logged!")}>+ Log Trip</button>
          </div>
          {[{desc:"Supply run — Beauty Supply Plus",date:"Feb 14",miles:12.4},{desc:"Bank deposit",date:"Feb 10",miles:8.2},{desc:"Client house call",date:"Feb 6",miles:22.8},{desc:"Trade show — NOLA Barber Expo",date:"Jan 28",miles:45.0}].map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <div><div style={{fontSize:13,fontWeight:600}}>{m.desc}</div><div style={{fontSize:11,color:C.muted}}>{m.date}</div></div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:700}}>{m.miles} mi</div>
                <div style={{fontSize:11,color:C.green}}>${(m.miles*0.585).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </>}
      </div>

      {/* Add expense modal */}
      {addModal&&(
        <div className="ov" onClick={()=>setAddModal(false)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <div className="mh"/>
            <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:16}}>Add Expense</h3>
            <div style={{marginBottom:12}}><label className="lbl">Description</label><input className="inp" placeholder="e.g. Clippers oil" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))}/></div>
            <div style={{marginBottom:12}}><label className="lbl">Amount ($)</label><input className="inp" type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></div>
            <div style={{marginBottom:16}}><label className="lbl">Category</label><select className="sel" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{["Equipment","Supplies","Rent","Marketing","Insurance","Meals","Other"].map(c=><option key={c}>{c}</option>)}</select></div>
            <div className="trow" style={{marginBottom:16}}><div><div style={{fontSize:14,fontWeight:600}}>Tax deductible</div></div><Tog on={form.deductible} toggle={()=>setForm(f=>({...f,deductible:!f.deductible}))}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button className="bo" style={{padding:"12px"}} onClick={()=>setAddModal(false)}>Cancel</button>
              <button className="btn bg" onClick={addExpense} disabled={!form.desc||!form.amount}>Add Expense</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// SUPPLY REORDER SYSTEM
// ══════════════════════════════════════════
function SupplyReorderScreen({onClose}){
  const [items,setItems]=useState(SUPPLY_ITEMS);
  const [tab,setTab]=useState("stock");
  const [cart,setCart]=useState([]);
  const [pos,setPOs]=useState(PO_HISTORY);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const urgent=items.filter(i=>i.status==="urgent");
  const soon=items.filter(i=>i.status==="soon");

  const addToCart=(item)=>{
    setCart(c=>{
      const exists=c.find(i=>i.id===item.id);
      if(exists) return c.map(i=>i.id===item.id?{...i,qty:i.qty+1}:i);
      return [...c,{...item,qty:1}];
    });
    showToast(`${item.name} added to order`);
  };

  const placeOrder=()=>{
    const newPO={id:`PO-${String(pos.length+43).padStart(4,"0")}`,date:"Today",vendor:"Mixed",items:cart.map(i=>`${i.name} x${i.qty}`),total:cart.reduce((a,i)=>a+i.cost*i.qty,0),status:"ordered"};
    setPOs(p=>[newPO,...p]);
    setCart([]);
    showToast("Purchase order placed!");
  };

  const statusMeta={urgent:{color:C.red,label:"Order Now",bg:"rgba(224,82,82,.1)"},soon:{color:C.orange,label:"Order Soon",bg:"rgba(245,158,11,.1)"},ok:{color:C.green,label:"In Stock",bg:"rgba(76,175,122,.1)"}};

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Supply Reorder</h2>
          {cart.length>0&&<button className="bgh" onClick={()=>setTab("order")}>🛒 {cart.length}</button>}
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {["stock","order","vendors","history"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="stock"&&<>
          {/* Alert strip */}
          {(urgent.length>0||soon.length>0)&&(
            <div style={{background:"rgba(224,82,82,.08)",border:"1px solid rgba(224,82,82,.25)",borderRadius:14,padding:14,marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
              <span style={{fontSize:24}}>🚨</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.red}}>{urgent.length} items need immediate reorder</div>
                <div style={{fontSize:12,color:C.muted}}>{soon.length} more items running low</div>
              </div>
              <button className="bdgr" style={{flexShrink:0,fontSize:12}} onClick={()=>{urgent.forEach(i=>addToCart(i));showToast("All urgent items added!");}}>Order All</button>
            </div>
          )}

          {["urgent","soon","ok"].map(status=>{
            const filtered=items.filter(i=>i.status===status);
            if(!filtered.length)return null;
            const meta=statusMeta[status];
            return(
              <div key={status}>
                <p className="stit" style={{color:meta.color}}>{meta.label} ({filtered.length})</p>
                {filtered.map(item=>{
                  const pct=Math.round((item.qty/item.maxQty)*100);
                  return(
                    <div key={item.id} className={`reorder-card ${status}`}>
                      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                        <div style={{width:44,height:44,borderRadius:12,background:C.surface,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{item.icon}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:700}}>{item.name}</div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:6}}>{item.vendor} · ${item.cost}/{item.unit}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <div className="commission-bar" style={{flex:1}}>
                              <div className="commission-fill" style={{width:`${pct}%`,background:status==="urgent"?C.red:status==="soon"?C.orange:C.green}}/>
                            </div>
                            <span style={{fontSize:11,color:meta.color,fontWeight:700,flexShrink:0}}>{item.qty}/{item.maxQty} {item.unit}</span>
                          </div>
                        </div>
                        <button className="bgh" style={{fontSize:12,padding:"8px 12px",flexShrink:0,color:meta.color,borderColor:`${meta.color}60`}} onClick={()=>addToCart(item)}>+ Order</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>}

        {tab==="order"&&<>
          {cart.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
              <div style={{fontSize:48,marginBottom:10}}>🛒</div>
              <div style={{fontSize:15,fontWeight:700,color:C.text}}>Cart is empty</div>
              <div style={{fontSize:12,marginTop:4}}>Go to Stock tab and add items to reorder.</div>
            </div>
          ):(
            <>
              <p className="stit">Order Cart</p>
              {cart.map(item=>(
                <div key={item.id} className="reorder-card ok" style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:22,flexShrink:0}}>{item.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700}}>{item.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>{item.vendor}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div className="reorder-qty-btn" onClick={()=>setCart(c=>c.map(i=>i.id===item.id&&i.qty>1?{...i,qty:i.qty-1}:i).filter(i=>i.qty>0))}>−</div>
                    <span style={{fontSize:15,fontWeight:700,minWidth:20,textAlign:"center"}}>{item.qty}</span>
                    <div className="reorder-qty-btn" onClick={()=>setCart(c=>c.map(i=>i.id===item.id?{...i,qty:i.qty+1}:i))}>+</div>
                  </div>
                  <span style={{fontSize:14,fontWeight:700,color:C.text,minWidth:44,textAlign:"right"}}>${(item.cost*item.qty).toFixed(2)}</span>
                </div>
              ))}
              <div style={{background:C.card,borderRadius:14,padding:16,marginTop:8,border:`1px solid ${C.border}`,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:14,color:C.muted}}>Items</span><span style={{fontSize:14,fontWeight:600}}>{cart.reduce((a,i)=>a+i.qty,0)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:15,fontWeight:700}}>Order Total</span><span style={{fontSize:18,fontWeight:900,color:C.gold,fontFamily:"'Playfair Display',serif"}}>${cart.reduce((a,i)=>a+i.cost*i.qty,0).toFixed(2)}</span></div>
              </div>
              <button className="btn bg" style={{width:"100%"}} onClick={placeOrder}>Place Purchase Order 📦</button>
            </>
          )}
        </>}

        {tab==="vendors"&&<>
          <p className="stit">Vendor List</p>
          {[...new Set(items.map(i=>i.vendor))].map(vendor=>{
            const vItems=items.filter(i=>i.vendor===vendor);
            return(
              <div key={vendor}>
                <div className="vendor-row">
                  <div style={{width:44,height:44,borderRadius:12,background:`${C.blue}18`,border:`1px solid ${C.blue}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🏪</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700}}>{vendor}</div>
                    <div style={{fontSize:12,color:C.muted}}>{vItems[0].vendorPhone} · {vItems.length} products</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="bgh" style={{fontSize:11,padding:"6px 10px"}} onClick={()=>showToast("Calling "+vendor)}>📞</button>
                    <button className="bgh" style={{fontSize:11,padding:"6px 10px"}} onClick={()=>showToast("Order form opened")}>Order</button>
                  </div>
                </div>
              </div>
            );
          })}
        </>}

        {tab==="history"&&<>
          <p className="stit">Purchase Orders</p>
          {pos.map(po=>(
            <div key={po.id} className="po-card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700}}>{po.id}</div>
                  <div style={{fontSize:12,color:C.muted}}>{po.vendor} · {po.date}</div>
                </div>
                <span className={`po-status ${po.status}`}>{po.status==="delivered"?"✓ Delivered":po.status==="ordered"?"📦 Ordered":"⏳ Pending"}</span>
              </div>
              <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{po.items.join(", ")}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:15,fontWeight:800}}>${po.total.toFixed(2)}</span>
                <button className="bgh" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>showToast("PO detail opened")}>View →</button>
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// CLIENT CHECK-IN FLOW
// ══════════════════════════════════════════
function ClientCheckInScreen({onClose}){
  const [step,setStep]=useState("list"); // list | consult | confirm | done
  const [appts,setAppts]=useState(TODAYS_APPTS_CHECKIN);
  const [selAppt,setSelAppt]=useState(null);
  const [answers,setAnswers]=useState({});
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const CONSULT_QUESTIONS=[
    {id:"notes",label:"Any special requests today?",type:"text",ph:"e.g. Keep the top longer this time"},
    {id:"scalp",label:"Any scalp concerns?",type:"choice",options:["None","Dry / itchy","Sensitive","Dandruff"]},
    {id:"product",label:"Would you like any products today?",type:"choice",options:["No thanks","Pomade","Beard oil","Edge control","Surprise me"]},
    {id:"photo",label:"OK to use your photo in our portfolio?",type:"choice",options:["Yes, go ahead!","No thank you"]},
  ];

  const checkIn=(appt)=>{
    setSelAppt(appt);
    setAnswers({});
    setStep("consult");
  };

  const confirmCheckIn=()=>{
    setAppts(a=>a.map(ap=>ap.id===selAppt.id?{...ap,status:"checked-in"}:ap));
    setStep("done");
    setTimeout(()=>{setStep("list");setSelAppt(null);},2800);
  };

  const checked=appts.filter(a=>a.status==="checked-in").length;

  return(
    <div className="checkin-wrap">
      <Toast msg={toast}/>

      {/* Header */}
      <div className="checkin-hero">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13,background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700,color:C.gold}}>Client Check-In</h2>
          <span style={{fontSize:13,color:C.muted}}>{checked}/{appts.length} in</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          {[{l:"Checked In",v:checked,c:C.green},{l:"Upcoming",v:appts.filter(a=>a.status==="upcoming").length,c:C.blue},{l:"Total",v:appts.length,c:C.muted}].map(({l,v,c})=>(
            <div key={l} style={{flex:1,background:"rgba(255,255,255,.06)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:10,color:C.muted}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:"0 20px",paddingBottom:80,overflowY:"auto"}}>
        {step==="list"&&<>
          <p className="stit" style={{marginTop:16}}>Today's Appointments</p>
          {appts.map(appt=>(
            <div key={appt.id} className={`checkin-client-card${appt.status==="checked-in"?" sel":""}`} onClick={()=>appt.status!=="checked-in"&&checkIn(appt)}>
              <div className="pav" style={{width:46,height:46,fontSize:18,background:`linear-gradient(135deg,${appt.color},${appt.color}88)`,flexShrink:0}}>{appt.avatar}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:15,fontWeight:700}}>{appt.name}</span>
                  {appt.status==="checked-in"&&<span className="badge bgrn" style={{fontSize:9}}>✓ Checked In</span>}
                </div>
                <div style={{fontSize:12,color:C.muted}}>{appt.service} · {appt.time} · {appt.barber}</div>
              </div>
              {appt.status==="upcoming"&&<button className="btn bg" style={{fontSize:12,padding:"8px 16px",flexShrink:0}} onClick={e=>{e.stopPropagation();checkIn(appt);}}>Check In</button>}
              {appt.status==="checked-in"&&<span style={{fontSize:24,color:C.green}}>✓</span>}
            </div>
          ))}
          <button className="bo" style={{width:"100%",marginTop:14,padding:"12px",fontSize:13}} onClick={()=>showToast("Walk-in flow opened")}>+ Walk-In (No Appointment)</button>
        </>}

        {step==="consult"&&selAppt&&<>
          <div style={{paddingTop:16,marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <div className="pav" style={{width:52,height:52,fontSize:20,background:`linear-gradient(135deg,${selAppt.color},${selAppt.color}88)`}}>{selAppt.avatar}</div>
              <div>
                <div style={{fontSize:17,fontWeight:700}}>{selAppt.name}</div>
                <div style={{fontSize:13,color:C.muted}}>{selAppt.service} · {selAppt.time}</div>
              </div>
            </div>
            <div style={{fontSize:15,fontWeight:700,color:C.gold,marginBottom:16}}>📋 Quick Consultation</div>
            {CONSULT_QUESTIONS.map(q=>(
              <div key={q.id} className="consult-q">
                <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>{q.label}</div>
                {q.type==="text"?(
                  <input className="inp" placeholder={q.ph} value={answers[q.id]||""} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))}/>
                ):(
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {q.options.map(opt=>(
                      <div key={opt} onClick={()=>setAnswers(a=>({...a,[q.id]:opt}))} style={{padding:"8px 14px",borderRadius:20,border:`1px solid ${answers[q.id]===opt?C.gold:C.border}`,background:answers[q.id]===opt?`${C.gold}15`:C.surface,color:answers[q.id]===opt?C.gold:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .18s"}}>{opt}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button className="bo" style={{flex:1,padding:"12px"}} onClick={()=>setStep("list")}>← Back</button>
              <button className="btn bg" style={{flex:2}} onClick={confirmCheckIn}>Confirm Check-In ✓</button>
            </div>
          </div>
        </>}

        {step==="done"&&(
          <div className="checkin-status" style={{paddingTop:40}}>
            <div className="checkin-done-ring">✓</div>
            <h2 className="pf" style={{fontSize:24,fontWeight:700,color:C.green,marginTop:16}}>{selAppt?.name} is checked in!</h2>
            <p style={{fontSize:14,color:C.muted,marginTop:8}}>{selAppt?.service} · {selAppt?.time}</p>
            {answers.notes&&<div style={{background:`${C.gold}10`,border:`1px solid ${C.gold}30`,borderRadius:12,padding:"10px 14px",marginTop:14,fontSize:13,color:C.text}}>📝 "{answers.notes}"</div>}
            <p style={{fontSize:12,color:C.dim,marginTop:16}}>Returning to list...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// RECURRING APPOINTMENTS MANAGER
// ══════════════════════════════════════════
function RecurringApptScreen({onClose}){
  const [appts,setAppts]=useState(RECURRING_APPTS);
  const [filter,setFilter]=useState("All");
  const [editAppt,setEditAppt]=useState(null);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const freqColors={Weekly:C.blue,Biweekly:C.gold,Monthly:C.purple};
  const shown=filter==="All"?appts:filter==="Active"?appts.filter(a=>a.active):appts.filter(a=>!a.active);
  const totalMonthly=appts.filter(a=>a.active).reduce((s,a)=>{
    const mult=a.frequency==="Weekly"?4:a.frequency==="Biweekly"?2:1;
    return s+a.price*mult;
  },0);

  const togglePause=id=>{
    setAppts(a=>a.map(ap=>ap.id===id?{...ap,active:!ap.active}:ap));
    showToast("Recurring appointment updated");
  };

  // Build past/future timeline dots (last 4 + next 4)
  const buildTimeline=(appt)=>{
    const dots=[];
    for(let i=-3;i<=3;i++){
      dots.push({offset:i,type:i<0?"past":i===0?"upcoming":"upcoming",label:i===0?"Next":i<0?`${Math.abs(i)}w ago`:`+${i}w`});
    }
    return dots;
  };

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Recurring Appts</h2>
          <div style={{width:60}}/>
        </div>
        {/* Summary */}
        <div style={{display:"flex",gap:10,marginBottom:14}}>
          {[{l:"Active",v:appts.filter(a=>a.active).length,c:C.green},{l:"Paused",v:appts.filter(a=>!a.active).length,c:C.orange},{l:"Monthly Value",v:"$"+totalMonthly,c:C.gold}].map(({l,v,c})=>(
            <div key={l} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:9,color:C.muted}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:0}}>
          {["All","Active","Paused"].map(f=>(
            <div key={f} className={`svc-cat-chip${filter===f?" sel":""}`} onClick={()=>setFilter(f)}>{f}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>
        {shown.map(appt=>(
          <div key={appt.id} className={`recur-card${appt.active?"":" paused"}`}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
              <div className="pav" style={{width:44,height:44,fontSize:17,background:`linear-gradient(135deg,${appt.color},${appt.color}88)`,flexShrink:0}}>{appt.avatar}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:15,fontWeight:700}}>{appt.client}</span>
                  <span className={`recur-freq-badge ${appt.frequency.toLowerCase()}`}>{appt.frequency}</span>
                  {!appt.active&&<span className="badge borg" style={{fontSize:9}}>PAUSED</span>}
                </div>
                <div style={{fontSize:12,color:C.muted}}>{appt.service} · {appt.nextTime} · {appt.barber}</div>
                <div style={{display:"flex",gap:12,marginTop:6}}>
                  <span style={{fontSize:12,color:C.gold,fontWeight:700}}>${appt.price}</span>
                  <span style={{fontSize:12,color:C.muted}}>🔥 {appt.streak} streak</span>
                  <span style={{fontSize:12,color:C.muted}}>{appt.totalVisits} total</span>
                </div>
              </div>
            </div>

            {/* Mini timeline */}
            <div className="recur-timeline">
              {buildTimeline(appt).map((d,i)=>(
                <div key={i} className="recur-date-dot">
                  <div className={`recur-dot ${d.offset<0?"past":d.offset===0?"upcoming":""}`} style={{width:d.offset===0?14:10,height:d.offset===0?14:10,opacity:d.offset===0?1:Math.max(.3,1-Math.abs(d.offset)*0.18)}}/>
                  <span style={{fontSize:8,color:d.offset===0?C.blue:C.dim,fontWeight:d.offset===0?700:400,whiteSpace:"nowrap"}}>{d.label}</span>
                </div>
              ))}
            </div>

            <div style={{borderTop:`1px solid ${C.border}`,marginTop:12,paddingTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,color:C.muted}}>Next: <strong style={{color:C.text}}>{appt.nextDate} at {appt.nextTime}</strong></div>
                <div style={{fontSize:11,color:C.dim}}>Last: {appt.lastDate}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="bgh" style={{fontSize:11,padding:"6px 10px"}} onClick={()=>setEditAppt(appt)}>Edit</button>
                <button onClick={()=>togglePause(appt.id)} style={{padding:"6px 10px",fontSize:11,fontWeight:600,borderRadius:8,border:`1px solid ${appt.active?C.orange:C.green}`,color:appt.active?C.orange:C.green,background:"transparent",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{appt.active?"Pause":"Resume"}</button>
              </div>
            </div>
          </div>
        ))}
        {shown.length===0&&<div style={{textAlign:"center",padding:"40px",color:C.muted}}><div style={{fontSize:40,marginBottom:10}}>🔄</div><div style={{fontSize:15,fontWeight:700,color:C.text}}>No {filter.toLowerCase()} recurring appointments</div></div>}
      </div>

      {editAppt&&(
        <div className="ov" onClick={()=>setEditAppt(null)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <div className="mh"/>
            <h3 className="pf" style={{fontSize:20,fontWeight:700,marginBottom:4}}>Edit Recurring</h3>
            <p style={{fontSize:13,color:C.muted,marginBottom:16}}>{editAppt.client} · {editAppt.service}</p>
            <div style={{marginBottom:12}}><label className="lbl">Frequency</label>
              <select className="sel" value={editAppt.frequency} onChange={e=>setEditAppt(a=>({...a,frequency:e.target.value}))}>
                {["Weekly","Biweekly","Monthly"].map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div style={{marginBottom:16}}><label className="lbl">Preferred Time</label><input className="inp" value={editAppt.nextTime} onChange={e=>setEditAppt(a=>({...a,nextTime:e.target.value}))}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button className="bo" style={{padding:"12px"}} onClick={()=>setEditAppt(null)}>Cancel</button>
              <button className="btn bg" onClick={()=>{setAppts(a=>a.map(ap=>ap.id===editAppt.id?editAppt:ap));showToast("Updated!");setEditAppt(null);}}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// EQUIPMENT MAINTENANCE TRACKER
// ══════════════════════════════════════════
function EquipmentScreen({onClose}){
  const [equip,setEquip]=useState(EQUIPMENT_INIT);
  const [logs]=useState(MAINT_LOGS);
  const [tab,setTab]=useState("equipment");
  const [selItem,setSelItem]=useState(null);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const statusOf=(item)=>{
    if(item.health<65)return "due";
    if(item.health<80)return "upcoming";
    return "ok";
  };
  const healthColor=(h)=>h>=80?C.green:h>=65?C.orange:C.red;

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Equipment</h2>
          <button className="bgh" onClick={()=>showToast("Add equipment form opened")}>+ Add</button>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {["equipment","logs","schedule"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="equipment"&&<>
          {/* Alert */}
          {equip.filter(e=>statusOf(e)==="due").length>0&&(
            <div style={{background:"rgba(224,82,82,.08)",border:"1px solid rgba(224,82,82,.25)",borderRadius:14,padding:14,marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:22}}>🔧</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.red}}>{equip.filter(e=>statusOf(e)==="due").length} items need maintenance</div>
                <div style={{fontSize:12,color:C.muted}}>Check overdue services below</div>
              </div>
            </div>
          )}

          {equip.map(item=>{
            const status=statusOf(item);
            const hc=healthColor(item.health);
            const r=24; const circ=2*Math.PI*r;
            const dash=circ*(item.health/100);
            return(
              <div key={item.id} className={`equip-card ${status}`} onClick={()=>setSelItem(selItem?.id===item.id?null:item)}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  {/* Health ring */}
                  <div className="health-ring">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r={r} fill="none" stroke={C.border} strokeWidth="4"/>
                      <circle cx="32" cy="32" r={r} fill="none" stroke={hc} strokeWidth="4" strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"/>
                    </svg>
                    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:800,color:hc,textAlign:"center"}}>{item.health}%</div>
                        <div style={{fontSize:7,color:C.dim,textAlign:"center"}}>health</div>
                      </div>
                    </div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:700,marginBottom:2}}>{item.icon} {item.name}</div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:4}}>{item.type} · {item.barber}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {item.lastOiled&&<span style={{fontSize:10,color:C.muted}}>🫙 Oiled {item.lastOiled}</span>}
                      {item.bladesChanged&&<span style={{fontSize:10,color:C.muted}}>🔪 Blades {item.bladesChanged}</span>}
                    </div>
                    {item.notes&&<div style={{fontSize:11,color:C.orange,marginTop:4}}>⚠️ {item.notes}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <span className={`badge ${status==="due"?"bred":status==="upcoming"?"borg":"bgrn"}`} style={{fontSize:9}}>{status==="due"?"Service Due":status==="upcoming"?"Coming Up":"Good"}</span>
                    <div style={{fontSize:11,color:C.muted,marginTop:4}}>Next: {item.nextService}</div>
                  </div>
                </div>

                {selItem?.id===item.id&&(
                  <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                      {[["Last Service",item.lastService],["Next Service",item.nextService],["Services Done",item.serviceCount],["Blade Interval",item.bladeInterval?item.bladeInterval+"d":"N/A"]].map(([l,v])=>(
                        <div key={l} style={{background:C.bg,borderRadius:10,padding:"8px 10px"}}>
                          <div style={{fontSize:10,color:C.muted}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:700}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <button className="bo" style={{padding:"10px",fontSize:12}} onClick={()=>showToast("Service log added!")}>📋 Log Service</button>
                      <button className="btn bg" style={{fontSize:12}} onClick={()=>{setEquip(eq=>eq.map(e=>e.id===item.id?{...e,health:100,lastService:"Today",nextService:"Apr 20",lastOiled:"Today"}:e));showToast("Equipment marked serviced!");}}>✓ Mark Serviced</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>}

        {tab==="logs"&&<>
          <p className="stit">Maintenance Log</p>
          {logs.map((log,i)=>(
            <div key={i} className="maint-log-row">
              <div className="maint-dot" style={{background:C.gold}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700}}>{log.equip}</div>
                <div style={{fontSize:13,color:C.text}}>{log.action}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{log.by} · {log.date}</div>
                {log.note&&<div style={{fontSize:11,color:C.orange,marginTop:3}}>⚠️ {log.note}</div>}
              </div>
            </div>
          ))}
        </>}

        {tab==="schedule"&&<>
          <p className="stit">Upcoming Maintenance</p>
          {[...equip].sort((a,b)=>a.health-b.health).map(item=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:22,width:30}}>{item.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700}}>{item.name}</div>
                <div style={{fontSize:12,color:C.muted}}>{item.barber} · Next service: {item.nextService}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:700,color:healthColor(item.health)}}>{item.health}%</div>
                <div style={{fontSize:10,color:C.dim}}>health</div>
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// TIME CLOCK / SHIFT MANAGEMENT
// ══════════════════════════════════════════
function TimeClockScreen({onClose}){
  const [barbers,setBarbers]=useState(TIMECLOCK_BARBERS);
  const [tab,setTab]=useState("clock");
  const [myBarber,setMyBarber]=useState(TIMECLOCK_BARBERS[0]);
  const [time,setTime]=useState("10:41 AM");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const isClockedIn=myBarber.clockedIn;

  const handleClock=()=>{
    const nowStr="10:41 AM";
    setBarbers(bs=>bs.map(b=>b.id===myBarber.id?{...b,clockedIn:!b.clockedIn,clockInTime:!b.clockedIn?nowStr:null}:b));
    setMyBarber(b=>({...b,clockedIn:!b.clockedIn,clockInTime:!b.clockedIn?nowStr:null}));
    showToast(isClockedIn?"Clocked out!":"Clocked in — have a great shift! 💈");
  };

  const totalHoursToday=barbers.reduce((a,b)=>a+b.hoursToday,0);

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Time Clock</h2>
          <div style={{width:60}}/>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {["clock","staff","shifts","summary"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="clock"&&<>
          {/* My clock card */}
          <div className="timeclock-hero">
            <div style={{fontSize:12,color:C.muted,letterSpacing:.5,marginBottom:4}}>CURRENT TIME</div>
            <div className="clock-display">{time}</div>
            <div style={{fontSize:13,color:isClockedIn?C.green:C.muted,fontWeight:700,marginBottom:4}}>
              {isClockedIn?`🟢 Clocked in since ${myBarber.clockInTime}`:"⚫ Not clocked in"}
            </div>
            {isClockedIn&&<div style={{fontSize:12,color:C.muted}}>Today: {myBarber.hoursToday.toFixed(1)}h · Week: {myBarber.hoursWeek}h</div>}
          </div>

          {/* Barber selector */}
          <p className="stit">Clocking in as</p>
          <div style={{display:"flex",gap:8,overflowX:"auto",scrollbarWidth:"none",marginBottom:16,paddingBottom:4}}>
            {barbers.map(b=>(
              <div key={b.id} onClick={()=>setMyBarber(b)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",flexShrink:0,padding:4}}>
                <div className="pav" style={{width:48,height:48,fontSize:18,background:`linear-gradient(135deg,${b.color},${b.color}88)`,border:`2px solid ${myBarber.id===b.id?C.gold:"transparent"}`,transition:"border .18s"}}>{b.avatar}</div>
                <span style={{fontSize:10,fontWeight:600,color:myBarber.id===b.id?C.gold:C.muted}}>{b.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>

          <button className={`clock-btn ${isClockedIn?"out":"in"}`} onClick={handleClock}>
            {isClockedIn?`⏹ Clock Out — ${myBarber.name.split(" ")[0]}`:`▶ Clock In — ${myBarber.name.split(" ")[0]}`}
          </button>

          {isClockedIn&&(
            <div style={{marginTop:12,background:C.card,borderRadius:14,padding:14,border:`1px solid rgba(76,175,122,.3)`}}>
              <div style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:8}}>📍 Currently On Shift</div>
              {[["Clocked in",myBarber.clockInTime||"—"],["Hours today",myBarber.hoursToday.toFixed(1)+"h"],["This week",myBarber.hoursWeek+"h"],["Overtime",myBarber.overtimeHours>0?myBarber.overtimeHours+"h ⚠️":"None"]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:13,color:C.muted}}>{l}</span>
                  <span style={{fontSize:13,fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </>}

        {tab==="staff"&&<>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:16,display:"flex",gap:16,justifyContent:"center"}}>
            {[{l:"Clocked In",v:barbers.filter(b=>b.clockedIn).length,c:C.green},{l:"Off",v:barbers.filter(b=>!b.clockedIn).length,c:C.dim},{l:"Hours Today",v:totalHoursToday.toFixed(1)+"h",c:C.blue}].map(({l,v,c})=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div>
                <div style={{fontSize:10,color:C.muted}}>{l}</div>
              </div>
            ))}
          </div>
          <p className="stit">Staff Status</p>
          {barbers.map(b=>(
            <div key={b.id} className={`staff-clock-row${b.clockedIn?" clocked-in":""}`}>
              <div className="pav" style={{width:42,height:42,fontSize:16,background:`linear-gradient(135deg,${b.color},${b.color}88)`,flexShrink:0}}>{b.avatar}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:14,fontWeight:700}}>{b.name}</span>
                  <div className={`clock-status-dot ${b.clockedIn?"in":"out"}`}/>
                </div>
                {b.clockedIn?(
                  <div style={{fontSize:12,color:C.green}}>Since {b.clockInTime} · {b.hoursToday.toFixed(1)}h today</div>
                ):(
                  <div style={{fontSize:12,color:C.muted}}>Not clocked in · {b.hoursToday}h today</div>
                )}
                <div className="shift-bar-wrap" style={{marginTop:6}}>
                  <div style={{fontSize:10,color:C.dim,flexShrink:0}}>Week</div>
                  <div className="shift-bar">
                    <div className="shift-bar-fill" style={{width:`${Math.min(100,(b.hoursWeek/40)*100)}%`,background:b.color}}/>
                  </div>
                  <span style={{fontSize:10,color:C.muted,flexShrink:0}}>{b.hoursWeek}h</span>
                </div>
              </div>
            </div>
          ))}
        </>}

        {tab==="shifts"&&<>
          <p className="stit">Recent Shifts</p>
          {SHIFT_LOG.map((s,i)=>(
            <div key={i} className="shift-row">
              <div className="pav" style={{width:36,height:36,fontSize:13,background:`linear-gradient(135deg,${s.barber==="Marcus"?C.gold:s.barber==="Darius"?C.blue:C.green},${s.barber==="Marcus"?C.goldDim:s.barber==="Darius"?C.blue:C.green}88)`,flexShrink:0}}>{s.barber[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700}}>{s.barber}</div>
                <div style={{fontSize:11,color:C.muted}}>{s.date} · In {s.in} → {s.out}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:700,color:s.status==="active"?C.green:C.text}}>{s.hours}</div>
                {s.status==="active"&&<span className="badge bgrn" style={{fontSize:9}}>Active</span>}
              </div>
            </div>
          ))}
        </>}

        {tab==="summary"&&<>
          <p className="stit">This Week — Feb 16–20</p>
          {barbers.map(b=>{
            const scheduled=40;
            const pct=Math.min(100,(b.hoursWeek/scheduled)*100);
            return(
              <div key={b.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div className="pav" style={{width:40,height:40,fontSize:15,background:`linear-gradient(135deg,${b.color},${b.color}88)`}}>{b.avatar}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700}}>{b.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>{b.hoursWeek}h of {scheduled}h scheduled</div>
                  </div>
                  <div style={{fontSize:20,fontWeight:800,color:b.color}}>{b.hoursWeek}h</div>
                </div>
                <div className="shift-bar" style={{height:8,borderRadius:4}}>
                  <div className="shift-bar-fill" style={{width:`${pct}%`,background:`linear-gradient(90deg,${b.color},${b.color}88)`,height:"100%",borderRadius:4}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
                  {[["Avg/Day",(b.hoursWeek/5).toFixed(1)+"h"],["Overtime",b.overtimeHours+"h"],["Est. Pay","$"+(b.hoursWeek*(b.id===1?0:18)).toFixed(0)]].map(([l,v])=>(
                    <div key={l} style={{textAlign:"center"}}>
                      <div style={{fontSize:14,fontWeight:800}}>{v}</div>
                      <div style={{fontSize:9,color:C.muted}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// ══════════════════════════════════════════
// IN-APP CHAT (CLIENT ↔ BARBER)
// ══════════════════════════════════════════
function InAppChatScreen({onClose}){
  const [view,setView]=useState("list"); // list | thread
  const [selClient,setSelClient]=useState(null);
  const [clients,setClients]=useState(CHAT_CLIENTS);
  const [threads,setThreads]=useState(CHAT_THREADS);
  const [draft,setDraft]=useState("");
  const [searchQ,setSearchQ]=useState("");
  const threadRef=useRef(null);

  const openThread=(client)=>{
    setSelClient(client);
    setClients(cs=>cs.map(c=>c.id===client.id?{...c,unread:0}:c));
    setView("thread");
    setTimeout(()=>{if(threadRef.current)threadRef.current.scrollTop=threadRef.current.scrollHeight;},100);
  };

  const sendMsg=()=>{
    if(!draft.trim())return;
    const msg={id:Date.now(),from:"barber",text:draft.trim(),time:"Now",type:"text"};
    setThreads(t=>({...t,[selClient.id]:[...(t[selClient.id]||[]),msg]}));
    setClients(cs=>cs.map(c=>c.id===selClient.id?{...c,lastMsg:draft.trim(),time:"Now"}:c));
    setDraft("");
    setTimeout(()=>{if(threadRef.current)threadRef.current.scrollTop=threadRef.current.scrollHeight;},80);
  };

  const QUICK_REPLIES=["On my way!","You're all set ✓","See you then 💈","Running ~10 min late","Check your booking confirmation"];
  const filtered=clients.filter(c=>c.name.toLowerCase().includes(searchQ.toLowerCase()));
  const totalUnread=clients.reduce((a,c)=>a+c.unread,0);

  // ── THREAD VIEW ──
  if(view==="thread"&&selClient){
    const msgs=threads[selClient.id]||[];
    return(
      <div className="chat-wrap">
        {/* Thread header */}
        <div className="chat-header">
          <button className="bo" style={{padding:"6px 12px",fontSize:13,flexShrink:0}} onClick={()=>setView("list")}>←</button>
          <div style={{position:"relative",flexShrink:0}}>
            <div className="pav" style={{width:40,height:40,fontSize:16,background:`linear-gradient(135deg,${selClient.color},${selClient.color}88)`}}>{selClient.avatar}</div>
            {selClient.online&&<div className="online-dot"/>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selClient.name}</div>
            <div style={{fontSize:11,color:selClient.online?C.green:C.muted}}>{selClient.online?"Online now":selClient.appt}</div>
          </div>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            <button className="bgh" style={{fontSize:18,padding:"7px 10px"}} onClick={()=>{}}>📞</button>
            <button className="bgh" style={{fontSize:18,padding:"7px 10px"}} onClick={()=>{}}>📅</button>
          </div>
        </div>

        {/* Appt context strip */}
        {selClient.appt!=="No upcoming"&&(
          <div style={{padding:"8px 16px",background:`${C.gold}10`,borderBottom:`1px solid ${C.gold}25`,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>📅</span>
            <span style={{fontSize:12,color:C.gold,fontWeight:600}}>{selClient.appt}</span>
          </div>
        )}

        {/* Messages */}
        <div className="chat-thread" ref={threadRef}>
          <div className="chat-bubble system">Feb 20, 2026</div>
          {msgs.map(msg=>(
            <div key={msg.id} style={{display:"flex",flexDirection:"column",alignItems:msg.from==="barber"?"flex-end":"flex-start",gap:3}}>
              <div className={`chat-bubble ${msg.from==="barber"?"out":"in"}`}>{msg.text}</div>
              <span style={{fontSize:10,color:C.dim,paddingLeft:msg.from==="barber"?0:4,paddingRight:msg.from==="barber"?4:0}}>{msg.time}</span>
            </div>
          ))}
          {msgs.length===0&&<div style={{textAlign:"center",color:C.muted,padding:"20px 0",fontSize:13}}>No messages yet — say hello!</div>}
        </div>

        {/* Quick replies */}
        <div style={{padding:"8px 16px 4px",display:"flex",gap:8,overflowX:"auto",scrollbarWidth:"none",flexShrink:0}}>
          {QUICK_REPLIES.map(r=>(
            <div key={r} onClick={()=>setDraft(r)} style={{padding:"6px 12px",borderRadius:16,background:C.card,border:`1px solid ${C.border}`,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,color:C.muted,transition:"all .15s"}}>{r}</div>
          ))}
        </div>

        {/* Input */}
        <div className="chat-input-row">
          <button className="bgh" style={{fontSize:20,padding:"8px 10px",flexShrink:0}} onClick={()=>{}}>＋</button>
          <textarea className="chat-input" rows={1} placeholder="Message..." value={draft} onChange={e=>setDraft(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}}
          />
          <button className="chat-send-btn" onClick={sendMsg} style={{opacity:draft.trim()?1:.4}}>➤</button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return(
    <div className="chat-wrap">
      <div className="chat-header" style={{flexDirection:"column",alignItems:"stretch",gap:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button className="bo" style={{padding:"6px 12px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Messages {totalUnread>0&&<span style={{fontSize:14,color:C.gold}}>({totalUnread})</span>}</h2>
          <button className="bgh" style={{fontSize:13}} onClick={()=>{}}>✏️ New</button>
        </div>
        <input className="inp" placeholder="🔍  Search clients..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{margin:0,fontSize:13}}/>
      </div>

      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>No conversations found</div>}
        {filtered.map(client=>(
          <div key={client.id} className="chat-list-item" onClick={()=>openThread(client)}>
            <div style={{position:"relative",flexShrink:0}}>
              <div className="pav" style={{width:48,height:48,fontSize:18,background:`linear-gradient(135deg,${client.color},${client.color}88)`}}>{client.avatar}</div>
              {client.online&&<div className="online-dot"/>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{fontSize:15,fontWeight:client.unread>0?700:600}}>{client.name}</span>
                <span style={{fontSize:11,color:C.dim,flexShrink:0,marginLeft:8}}>{client.time}</span>
              </div>
              <div style={{fontSize:13,color:client.unread>0?C.text:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:client.unread>0?600:400}}>{client.lastMsg}</div>
              <div style={{fontSize:11,color:C.dim,marginTop:2}}>{client.appt}</div>
            </div>
            {client.unread>0&&<div className="chat-unread-count">{client.unread}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// DEPOSIT & PREPAYMENT FLOW
// ══════════════════════════════════════════
function DepositScreen({onClose}){
  const [tab,setTab]=useState("deposits");
  const [deposits,setDeposits]=useState(DEPOSITS_INIT);
  const [settings,setSettings]=useState({enabled:true,pct:25,refundPolicy:"48h",autoRemind:true,allowWaive:true});
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const pending=deposits.filter(d=>d.status==="pending");
  const paid=deposits.filter(d=>d.status==="paid");
  const totalHeld=paid.reduce((a,d)=>a+d.depositAmt,0);

  const sendReminder=id=>{showToast("Reminder sent via SMS!");};
  const markPaid=id=>{setDeposits(ds=>ds.map(d=>d.id===id?{...d,status:"paid",paidDate:"Today",method:"card"}:d));showToast("Deposit marked as paid!");};
  const processRefund=id=>{setDeposits(ds=>ds.map(d=>d.id===id?{...d,status:"refunded"}:d));showToast("Refund processed!");};

  const statusMeta={
    paid:{color:C.green,label:"Paid",bg:"rgba(76,175,122,.1)"},
    pending:{color:C.orange,label:"Pending",bg:"rgba(245,158,11,.08)"},
    refunded:{color:C.blue,label:"Refunded",bg:"rgba(91,156,246,.08)"},
  };

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Deposits</h2>
          <div style={{width:60}}/>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {["deposits","settings"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="deposits"&&<>
          {/* Summary strip */}
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[{l:"Pending",v:pending.length,c:C.orange},{l:"Collected",v:`$${totalHeld}`,c:C.green},{l:"Refunded",v:deposits.filter(d=>d.status==="refunded").length,c:C.blue}].map(({l,v,c})=>(
              <div key={l} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
                <div style={{fontSize:9,color:C.muted}}>{l}</div>
              </div>
            ))}
          </div>

          {pending.length>0&&(
            <div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)",borderRadius:14,padding:14,marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:22}}>⏳</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.orange}}>{pending.length} deposit{pending.length>1?"s":""} pending</div>
                <div style={{fontSize:12,color:C.muted}}>Send reminders to secure your bookings</div>
              </div>
              <button className="bgh" style={{fontSize:12,padding:"7px 12px",flexShrink:0}} onClick={()=>{pending.forEach(d=>sendReminder(d.id));showToast("Reminders sent to all pending!");}}>Remind All</button>
            </div>
          )}

          {["pending","paid","refunded"].map(status=>{
            const list=deposits.filter(d=>d.status===status);
            if(!list.length)return null;
            const meta=statusMeta[status];
            return(
              <div key={status}>
                <p className="stit" style={{color:meta.color,textTransform:"capitalize"}}>{meta.label} ({list.length})</p>
                {list.map(dep=>(
                  <div key={dep.id} className={`deposit-card ${status}`}>
                    <div style={{display:"flex",gap:12,alignItems:"center"}}>
                      <div className={`deposit-amount-ring ${status}`}>
                        <span style={{fontSize:13,fontWeight:800}}>${dep.depositAmt}</span>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:700}}>{dep.client}</div>
                        <div style={{fontSize:12,color:C.muted}}>{dep.service}</div>
                        <div style={{fontSize:11,color:C.dim,marginTop:2}}>📅 {dep.apptDate}</div>
                        <div style={{fontSize:12,marginTop:4}}>
                          <span style={{color:C.muted}}>Deposit </span>
                          <span style={{fontWeight:700,color:meta.color}}>${dep.depositAmt}</span>
                          <span style={{color:C.muted}}> of </span>
                          <span style={{fontWeight:700}}>${dep.totalAmt}</span>
                          <span style={{color:C.muted}}> total</span>
                        </div>
                      </div>
                    </div>
                    {status==="pending"&&(
                      <div style={{display:"flex",gap:8,marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                        <button className="bo" style={{flex:1,padding:"9px",fontSize:12}} onClick={()=>sendReminder(dep.id)}>📱 Remind</button>
                        <button className="btn bg" style={{flex:2,fontSize:12}} onClick={()=>markPaid(dep.id)}>✓ Mark Paid</button>
                      </div>
                    )}
                    {status==="paid"&&(
                      <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:11,color:C.muted}}>Paid {dep.paidDate} · {dep.method==="apple"?"Apple Pay":"Card"}</span>
                        <button className="bo" style={{fontSize:11,padding:"5px 10px",color:C.blue,borderColor:`${C.blue}50`}} onClick={()=>processRefund(dep.id)}>Refund</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </>}

        {tab==="settings"&&<>
          <p className="stit">Deposit Settings</p>
          <div className="card" style={{marginBottom:14}}>
            <div className="prepay-toggle-row">
              <div><div style={{fontSize:14,fontWeight:700}}>Require deposits at booking</div><div style={{fontSize:12,color:C.muted}}>Clients must pay to confirm</div></div>
              <Tog on={settings.enabled} toggle={()=>setSettings(s=>({...s,enabled:!s.enabled}))}/>
            </div>
            <div className="prepay-toggle-row">
              <div><div style={{fontSize:14,fontWeight:700}}>Auto-remind unpaid deposits</div><div style={{fontSize:12,color:C.muted}}>SMS 48h before appointment</div></div>
              <Tog on={settings.autoRemind} toggle={()=>setSettings(s=>({...s,autoRemind:!s.autoRemind}))}/>
            </div>
            <div className="prepay-toggle-row" style={{borderBottom:"none"}}>
              <div><div style={{fontSize:14,fontWeight:700}}>Allow manager waive</div><div style={{fontSize:12,color:C.muted}}>Skip deposit for VIP clients</div></div>
              <Tog on={settings.allowWaive} toggle={()=>setSettings(s=>({...s,allowWaive:!s.allowWaive}))}/>
            </div>
          </div>

          <p className="stit">Deposit Amount</p>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {[{v:10,l:"$10 flat"},{v:15,l:"$15 flat"},{v:20,l:"$20 flat"},{v:25,l:"25%"},{v:50,l:"50%"},{v:100,l:"Full prepay"}].map(({v,l})=>(
              <div key={v} className={`pct-chip${settings.pct===v?" sel":""}`} onClick={()=>{setSettings(s=>({...s,pct:v}));showToast("Deposit amount updated");}}>{l}</div>
            ))}
          </div>

          <p className="stit">Refund Policy</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {[{v:"24h",l:"24h cancel"},{v:"48h",l:"48h cancel"},{v:"72h",l:"72h cancel"},{v:"none",l:"Non-refundable"}].map(({v,l})=>(
              <div key={v} className={`pct-chip${settings.refundPolicy===v?" sel":""}`} onClick={()=>{setSettings(s=>({...s,refundPolicy:v}));showToast("Refund policy updated");}}>{l}</div>
            ))}
          </div>

          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>📋 Policy Preview</div>
            <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>A deposit of <strong style={{color:C.text}}>{settings.pct<=20?"$"+settings.pct:settings.pct+"%"}</strong> is required to confirm your booking. Cancellations made <strong style={{color:C.text}}>{settings.refundPolicy==="none"?"for any reason will not be refunded":settings.refundPolicy+" before the appointment will receive a full refund"}</strong>. No-shows forfeit the deposit.</div>
          </div>
          <button className="btn bg" style={{width:"100%"}} onClick={()=>showToast("Settings saved!")}>Save Policy</button>
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// DAILY BRIEFING / MORNING REPORT
// ══════════════════════════════════════════
function DailyBriefingScreen({onClose}){
  const [dismissed,setDismissed]=useState(false);
  const [tab,setTab]=useState("today");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const TODAY_APPTS=[
    {time:"10:00 AM",client:"Marcus J.",service:"Fade + Beard",barber:"Marcus",value:54,deposit:"✓",status:"checked-in"},
    {time:"11:30 AM",client:"DeShawn W.",service:"Shape-Up",barber:"Marcus",value:30,deposit:"✓",status:"upcoming"},
    {time:"1:00 PM",client:"Tre L.",service:"Braids",barber:"Darius",value:95,deposit:"–",status:"upcoming"},
    {time:"3:30 PM",client:"Carlos M.",service:"Color + Fade",barber:"Darius",value:80,deposit:"✓",status:"upcoming"},
    {time:"5:00 PM",client:"Brandon K.",service:"Haircut",barber:"Jerome",value:37,deposit:"–",status:"upcoming"},
  ];
  const projectedRevenue=TODAY_APPTS.reduce((a,ap)=>a+ap.value,0);
  const ACTION_ITEMS=[
    {icon:"📦",label:"Clipper oil is critically low",action:"Order Now",color:C.red},
    {icon:"⭐",label:"2 review requests unsent from yesterday",action:"Send Now",color:C.gold},
    {icon:"💬",label:"DeShawn is asking to reschedule",action:"Reply",color:C.blue},
    {icon:"🔔",label:"Darius hasn't clocked in yet",action:"Check",color:C.orange},
  ];

  return(
    <div className="briefing-wrap">
      <Toast msg={toast}/>
      {/* Hero */}
      <div className="briefing-hero">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
          <div>
            <div className="weather-chip" style={{marginBottom:10}}>☀️ 74°F · Clear · New Orleans</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:4}}>Thursday, February 20, 2026</div>
            <h1 className="pf" style={{fontSize:28,fontWeight:700,color:C.gold,lineHeight:1.1}}>Good morning,<br/>Marcus 👋</h1>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer",padding:4,lineHeight:1,flexShrink:0}}>✕</button>
        </div>
        {/* Revenue target */}
        <div style={{marginTop:16,background:"rgba(0,0,0,.3)",borderRadius:14,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:12,color:C.muted}}>Today's projected revenue</span>
            <span style={{fontSize:18,fontWeight:800,color:C.gold,fontFamily:"'Playfair Display',serif"}}>${projectedRevenue}</span>
          </div>
          <div className="pb"><div className="pbf" style={{width:`${Math.min(100,(projectedRevenue/300)*100)}%`}}/></div>
          <div style={{fontSize:11,color:C.dim,marginTop:4}}>${projectedRevenue} of $300 daily target</div>
        </div>
      </div>

      <div style={{padding:"0 20px",paddingBottom:80}}>
        {/* Quick stats */}
        <div style={{display:"flex",gap:10,marginBottom:20,marginTop:20}}>
          {[{icon:"📅",l:"Appointments",v:TODAY_APPTS.length},{icon:"👥",l:"Clients",v:5},{icon:"🕐",l:"First appt",v:"10 AM"},{icon:"🏁",l:"Last appt",v:"5 PM"}].map(({icon,l,v})=>(
            <div key={l} className="briefing-stat-card">
              <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
              <div style={{fontSize:18,fontWeight:800}}>{v}</div>
              <div style={{fontSize:9,color:C.muted}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="ptabs" style={{marginBottom:16}}>
          {["today","action","goals"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>

        {tab==="today"&&<>
          <p className="stit">Today's Schedule</p>
          {TODAY_APPTS.map((ap,i)=>(
            <div key={i} className="briefing-appt-row">
              <div style={{width:54,flexShrink:0,textAlign:"center"}}>
                <div style={{fontSize:12,fontWeight:700,color:C.gold}}>{ap.time.split(" ")[0]}</div>
                <div style={{fontSize:10,color:C.dim}}>{ap.time.split(" ")[1]}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ap.client}</div>
                <div style={{fontSize:12,color:C.muted}}>{ap.service} · {ap.barber}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:700,color:C.green}}>${ap.value}</div>
                <div style={{fontSize:10,color:ap.deposit==="✓"?C.green:C.dim}}>Dep: {ap.deposit}</div>
              </div>
              {ap.status==="checked-in"&&<span className="badge bgrn" style={{fontSize:9,flexShrink:0,marginLeft:8}}>In</span>}
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0",borderTop:`1px solid ${C.border}`,marginTop:4}}>
            <span style={{fontSize:14,fontWeight:700}}>Projected Total</span>
            <span style={{fontSize:18,fontWeight:900,color:C.gold,fontFamily:"'Playfair Display',serif"}}>${projectedRevenue}</span>
          </div>

          {/* Staff status */}
          <p className="stit">Staff Today</p>
          {[{name:"Marcus J.",status:"Clocked in 9:02 AM",c:C.gold,in:true},{name:"Darius B.",status:"Clocked in 9:15 AM",c:C.blue,in:true},{name:"Jerome W.",status:"Not clocked in",c:C.muted,in:false}].map(b=>(
            <div key={b.name} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:b.in?C.green:C.dim,boxShadow:b.in?`0 0 6px ${C.green}`:"none",flexShrink:0}}/>
              <span style={{fontSize:14,fontWeight:600,flex:1}}>{b.name}</span>
              <span style={{fontSize:12,color:b.in?C.green:C.orange}}>{b.status}</span>
            </div>
          ))}
        </>}

        {tab==="action"&&<>
          <p className="stit">Action Items ({ACTION_ITEMS.length})</p>
          {ACTION_ITEMS.map((item,i)=>(
            <div key={i} className="briefing-action-card" onClick={()=>showToast(item.action+" — opened!")}>
              <div style={{width:44,height:44,borderRadius:12,background:`${item.color}15`,border:`1px solid ${item.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{item.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600}}>{item.label}</div>
              </div>
              <button className="bgh" style={{fontSize:11,padding:"6px 12px",flexShrink:0,color:item.color,borderColor:`${item.color}50`}} onClick={e=>{e.stopPropagation();showToast(item.action+" — done!");}}>{item.action}</button>
            </div>
          ))}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginTop:8}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>✅ Completed yesterday</div>
            {["5 appointments completed","$296 revenue collected","2 reviews collected","All staff clocked out"].map(t=>(
              <div key={t} style={{display:"flex",gap:8,alignItems:"center",padding:"5px 0"}}>
                <span style={{color:C.green,fontSize:14}}>✓</span>
                <span style={{fontSize:12,color:C.muted}}>{t}</span>
              </div>
            ))}
          </div>
        </>}

        {tab==="goals"&&<>
          <p className="stit">Monthly Goal Progress</p>
          {[{icon:"💰",l:"Revenue",curr:2290,target:3000,unit:"$"},{icon:"👤",l:"New Clients",curr:14,target:20,unit:""},{icon:"⭐",l:"5-Star Reviews",curr:6,target:10,unit:""},{icon:"📅",l:"Appointments",curr:63,target:80,unit:""}].map(g=>{
            const pct=Math.min(100,Math.round((g.curr/g.target)*100));
            return(
              <div key={g.l} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:13,fontWeight:600}}>{g.icon} {g.l}</span>
                  <span style={{fontSize:13,fontWeight:700,color:pct>=80?C.green:pct>=50?C.orange:C.red}}>{g.unit==="$"?"$":""}{g.curr}/{g.unit==="$"?"$":""}{g.target} · {pct}%</span>
                </div>
                <div className="pb"><div className="pbf" style={{width:`${pct}%`,background:pct>=80?C.green:pct>=50?C.orange:C.red}}/></div>
              </div>
            );
          })}
          <button className="bo" style={{width:"100%",padding:"12px",marginTop:8}} onClick={()=>showToast("Full forecast opened!")}>View Full Forecast →</button>
        </>}

        <button className="btn bg" style={{width:"100%",marginTop:20}} onClick={onClose}>Start My Day 💈</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// STAFF PERFORMANCE SCORECARDS
// ══════════════════════════════════════════
function StaffScorecardsScreen({onClose}){
  const [selBarber,setSelBarber]=useState(SCORECARD_BARBERS[0]);
  const [tab,setTab]=useState("overview");
  const [period,setPeriod]=useState("feb");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const PERIODS=[{id:"feb",l:"Feb 2026"},{id:"jan",l:"Jan 2026"},{id:"q1",l:"Q1 2026"}];
  const rankClass=(r)=>r===1?"r1":r===2?"r2":"r3";
  const trendColor=(t)=>t&&t.startsWith("+")?C.green:t&&t.startsWith("-")?C.red:C.muted;

  // Goals state per barber
  const defaultGoals=(b)=>[
    {key:"revenue",l:"Monthly Revenue",icon:"💰",unit:"$",curr:b.kpis.revenue,target:3000},
    {key:"services",l:"Services / Month",icon:"✂️",unit:"",curr:b.kpis.services,target:70},
    {key:"rebooking",l:"Rebook Rate",icon:"📅",unit:"%",curr:b.kpis.rebooking,target:85},
    {key:"rating",l:"Avg Rating",icon:"⭐",unit:"★",curr:b.kpis.rating,target:5.0},
    {key:"newClients",l:"New Clients",icon:"👤",unit:"",curr:b.kpis.newClients,target:20},
  ];
  const [goals,setGoals]=useState(()=>{
    const obj={};
    SCORECARD_BARBERS.forEach(b=>{obj[b.id]=defaultGoals(b).map(g=>({...g}));});
    return obj;
  });
  const [editGoal,setEditGoal]=useState(null); // {barberId, goalKey, value}
  const [coachNotes,setCoachNotes]=useState(()=>{
    const obj={};
    SCORECARD_BARBERS.forEach(b=>{obj[b.id]="";});
    return obj;
  });
  const [savedNotes,setSavedNotes]=useState({});

  const KPI_META=[
    {key:"revenue",label:"Revenue",unit:"$",icon:"💰",format:v=>"$"+v.toLocaleString()},
    {key:"services",label:"Services",unit:"",icon:"✂️",format:v=>v},
    {key:"avgTicket",label:"Avg Ticket",unit:"$",icon:"🎫",format:v=>"$"+v},
    {key:"retention",label:"Retention",unit:"%",icon:"🔄",format:v=>v+"%"},
    {key:"rating",label:"Rating",unit:"★",icon:"⭐",format:v=>v+"★"},
    {key:"rebooking",label:"Rebook Rate",unit:"%",icon:"📅",format:v=>v+"%"},
    {key:"noShows",label:"No-Shows",unit:"",icon:"🚫",format:v=>v},
    {key:"newClients",label:"New Clients",unit:"",icon:"👤",format:v=>v},
  ];

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Scorecards</h2>
          <button className="bgh" style={{fontSize:12}} onClick={()=>showToast("Report exported!")}>Export</button>
        </div>

        {/* Period selector */}
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {PERIODS.map(p=>(
            <div key={p.id} className={`svc-cat-chip${period===p.id?" sel":""}`} onClick={()=>setPeriod(p.id)}>{p.l}</div>
          ))}
        </div>

        {/* Barber tabs */}
        <div style={{display:"flex",gap:10,overflowX:"auto",scrollbarWidth:"none",paddingBottom:4}}>
          {SCORECARD_BARBERS.map(b=>(
            <div key={b.id} onClick={()=>setSelBarber(b)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>
              <div style={{position:"relative"}}>
                <div className="pav" style={{width:52,height:52,fontSize:20,background:`linear-gradient(135deg,${b.color},${b.color}88)`,border:`2px solid ${selBarber.id===b.id?C.gold:"transparent"}`,transition:"border .18s"}}>{b.avatar}</div>
                <div className={`rank-badge ${rankClass(b.rank)}`} style={{position:"absolute",bottom:-4,right:-4,width:22,height:22,fontSize:10}}>#{b.rank}</div>
              </div>
              <span style={{fontSize:11,fontWeight:600,color:selBarber.id===b.id?C.gold:C.muted}}>{b.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
        <div className="ptabs" style={{marginBottom:0,marginTop:12}}>
          {["overview","kpis","compare","goals","coaching"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",fontSize:11}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="overview"&&<>
          {/* Hero */}
          <div className="scorecard-hero">
            <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:14}}>
              <div className="pav" style={{width:56,height:56,fontSize:22,background:`linear-gradient(135deg,${selBarber.color},${selBarber.color}88)`,flexShrink:0}}>{selBarber.avatar}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:18,fontWeight:700}}>{selBarber.name}</div>
                <div style={{fontSize:12,color:C.muted}}>{selBarber.role}</div>
                <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
                  <div className={`rank-badge ${rankClass(selBarber.rank)}`}>#{selBarber.rank}</div>
                  <span style={{fontSize:12,color:C.muted}}>Shop rank this period</span>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:28,fontWeight:900,fontFamily:"'Playfair Display',serif",color:selBarber.color}}>${selBarber.kpis.revenue.toLocaleString()}</div>
                <div style={{fontSize:11,color:C.muted}}>revenue</div>
                <div style={{fontSize:12,color:trendColor(selBarber.trend.revenue),fontWeight:700,marginTop:2}}>{selBarber.trend.revenue}</div>
              </div>
            </div>

            {/* Key metrics row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
              {[{l:"Services",v:selBarber.kpis.services,t:selBarber.trend.services},{l:"Rating",v:selBarber.kpis.rating+"★",t:selBarber.trend.rating},{l:"Rebook",v:selBarber.kpis.rebooking+"%",t:selBarber.trend.rebooking},{l:"Avg $",v:"$"+selBarber.kpis.avgTicket}].map(({l,v,t})=>(
                <div key={l} style={{textAlign:"center",background:"rgba(0,0,0,.2)",borderRadius:10,padding:"8px 4px"}}>
                  <div style={{fontSize:16,fontWeight:800,color:selBarber.color}}>{v}</div>
                  <div style={{fontSize:9,color:C.dim}}>{l}</div>
                  {t&&<div style={{fontSize:10,color:trendColor(t),fontWeight:700}}>{t}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Performance bars */}
          <p className="stit">Performance Metrics</p>
          {[{l:"Client Retention",v:selBarber.kpis.retention,max:100,good:85},{l:"Rebooking Rate",v:selBarber.kpis.rebooking,max:100,good:80},{l:"No-Show Rate",v:Math.round((selBarber.kpis.noShows/selBarber.kpis.services)*100),max:15,good:5,lower:true},{l:"New Client %",v:Math.round((selBarber.kpis.newClients/selBarber.kpis.services)*100),max:30,good:15}].map(({l,v,max,good,lower})=>{
            const pct=(v/max)*100;
            const color=lower?(v<=good?C.green:v<=good*2?C.orange:C.red):(v>=good?C.green:v>=good*0.7?C.orange:C.red);
            return(
              <div key={l} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:13,fontWeight:600}}>{l}</span>
                  <span style={{fontSize:13,fontWeight:700,color}}>{v}{lower?" no-shows":"%"}</span>
                </div>
                <div className="score-meter">
                  <div className="score-fill" style={{width:`${pct}%`,background:color}}/>
                </div>
              </div>
            );
          })}

          {/* Insights */}
          <p className="stit">AI Insights</p>
          {selBarber.id===1?[
            {icon:"📈",txt:"Revenue up 18% — on track for best month ever. Keep pushing!"},
            {icon:"🔄",txt:"Your rebooking rate jumped +5% this month. Client loyalty is strong."},
          ]:selBarber.id===2?[
            {icon:"⚠️",txt:"No-show rate (9%) is above shop average. Consider requiring deposits."},
            {icon:"💡",txt:"Your color bookings generate 40% more per ticket — promote them more."},
          ]:[
            {icon:"📉",txt:"Rebooking rate dropped 2%. Try sending a personal follow-up SMS after each cut."},
            {icon:"💡",txt:"Tuesdays are your busiest day — consider a price bump of $5 to maximize earnings."},
          ]}.map((ins,i)=>(
            <div key={i} className="ai-insight-card" style={{marginBottom:10}}>
              <div className="insight-icon-wrap">{ins.icon}</div>
              <span style={{fontSize:13,lineHeight:1.5}}>{ins.txt}</span>
            </div>
          ))}
        </>}

        {tab==="kpis"&&<>
          <p className="stit">All KPIs — {selBarber.name.split(" ")[0]}</p>
          <div className="kpi-grid">
            {KPI_META.map(kpi=>(
              <div key={kpi.key} className={`kpi-card${kpi.key==="revenue"?" highlight":""}`}>
                <div style={{fontSize:22,marginBottom:4}}>{kpi.icon}</div>
                <div style={{fontSize:22,fontWeight:900,fontFamily:"'Playfair Display',serif",color:selBarber.color}}>{kpi.format(selBarber.kpis[kpi.key])}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{kpi.label}</div>
                {selBarber.trend[kpi.key]&&<div style={{fontSize:11,fontWeight:700,color:trendColor(selBarber.trend[kpi.key]),marginTop:4}}>{selBarber.trend[kpi.key]} vs last period</div>}
              </div>
            ))}
          </div>
        </>}

        {tab==="compare"&&<>
          <p className="stit">Shop Comparison — {period==="feb"?"Feb 2026":period==="jan"?"Jan 2026":"Q1 2026"}</p>
          {["revenue","services","rating","rebooking","noShows"].map(key=>{
            const kpi=KPI_META.find(k=>k.key===key);
            const max=Math.max(...SCORECARD_BARBERS.map(b=>b.kpis[key]));
            return(
              <div key={key} style={{marginBottom:18}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:8}}>{kpi.icon} {kpi.label}</div>
                {SCORECARD_BARBERS.map(b=>{
                  const pct=(b.kpis[key]/max)*100;
                  return(
                    <div key={b.id} style={{display:"flex",gap:10,alignItems:"center",marginBottom:6}}>
                      <div className="pav" style={{width:28,height:28,fontSize:11,background:`linear-gradient(135deg,${b.color},${b.color}88)`,flexShrink:0}}>{b.avatar}</div>
                      <div className="score-meter" style={{flex:1}}>
                        <div className="score-fill" style={{width:`${pct}%`,background:b.color}}/>
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:b.color,minWidth:54,textAlign:"right"}}>{kpi.format(b.kpis[key])}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>}

        {tab==="goals"&&(
          <>
            {editGoal&&(
              <div className="ov" onClick={()=>setEditGoal(null)}>
                <div className="mod" onClick={e=>e.stopPropagation()}>
                  <h3 style={{fontSize:17,fontWeight:700,marginBottom:16}}>Edit Goal — {editGoal.l}</h3>
                  <label className="lbl">Target Value</label>
                  <input
                    type="number"
                    defaultValue={editGoal.target}
                    id="goal-input"
                    className="inp"
                    style={{marginBottom:16}}
                    autoFocus
                  />
                  <button className="btn bg" style={{width:"100%",padding:"13px",marginBottom:10}} onClick={()=>{
                    const val=parseFloat(document.getElementById("goal-input").value)||editGoal.target;
                    setGoals(prev=>{
                      const updated={...prev};
                      updated[editGoal.barberId]=updated[editGoal.barberId].map(g=>g.key===editGoal.key?{...g,target:val}:g);
                      return updated;
                    });
                    setEditGoal(null);
                    showToast("✅ Goal updated!");
                  }}>Save Goal</button>
                  <button className="bo" style={{width:"100%",padding:"12px"}} onClick={()=>setEditGoal(null)}>Cancel</button>
                </div>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <p className="stit" style={{marginBottom:0}}>Goals — {selBarber.name}</p>
              <button className="bgh" style={{fontSize:12}} onClick={()=>showToast("Goals shared with barber!")}>📤 Share</button>
            </div>

            {/* Overall score */}
            {(()=>{
              const barberGoals=goals[selBarber.id]||[];
              const scores=barberGoals.map(g=>{
                const pct=g.key==="noShows"?Math.max(0,(1-(g.curr/g.target))*100):Math.min((g.curr/g.target)*100,100);
                return pct;
              });
              const avg=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
              const color=avg>=80?C.green:avg>=60?C.orange:C.red;
              return(
                <div style={{background:C.card,borderRadius:18,padding:18,marginBottom:16,display:"flex",gap:14,alignItems:"center",border:`1px solid ${color}33`}}>
                  <div style={{width:64,height:64,borderRadius:"50%",background:`conic-gradient(${color} ${avg*3.6}deg, ${C.surface} 0deg)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <div style={{width:50,height:50,borderRadius:"50%",background:C.card,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{fontSize:16,fontWeight:900,color}}>{avg}%</span>
                    </div>
                  </div>
                  <div>
                    <p style={{fontSize:16,fontWeight:700}}>Goal Achievement</p>
                    <p style={{fontSize:12,color:C.muted}}>{period==="feb"?"Feb 2026":period==="jan"?"Jan 2026":"Q1 2026"}</p>
                    <p style={{fontSize:12,color,fontWeight:600,marginTop:4}}>{avg>=80?"On track 🔥":avg>=60?"Making progress 📈":"Needs attention ⚠️"}</p>
                  </div>
                </div>
              );
            })()}

            {(goals[selBarber.id]||[]).map(g=>{
              const rawPct=g.key==="noShows"?Math.max(0,(1-(g.curr/g.target))*100):Math.min((g.curr/g.target)*100,100);
              const pct=Math.round(rawPct);
              const color=pct>=80?C.green:pct>=50?C.orange:C.red;
              return(
                <div key={g.key} className="card" style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:18}}>{g.icon}</span>
                      <div>
                        <p style={{fontSize:13,fontWeight:700}}>{g.l}</p>
                        <p style={{fontSize:11,color:C.muted}}>Current: {g.unit==="$"?"$":""}{g.curr}{g.unit==="★"?"★":g.unit==="%"?"%":""}</p>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <p style={{fontSize:13,fontWeight:800,color}}>Target: {g.unit==="$"?"$":""}{g.target}{g.unit==="★"?"★":g.unit==="%"?"%":""}</p>
                      <button className="bo" style={{fontSize:10,padding:"3px 10px",marginTop:4}} onClick={()=>setEditGoal({...g,barberId:selBarber.id})}>Edit</button>
                    </div>
                  </div>
                  <div style={{height:8,background:C.surface,borderRadius:4,overflow:"hidden",marginBottom:4}}>
                    <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:4,transition:"width .6s ease"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:10,color:C.dim}}>0</span>
                    <span style={{fontSize:11,fontWeight:700,color}}>{pct}%</span>
                    <span style={{fontSize:10,color:C.dim}}>Target</span>
                  </div>
                </div>
              );
            })}

            <button className="bo" style={{width:"100%",padding:"12px",marginTop:8}} onClick={()=>{
              setGoals(prev=>({...prev,[selBarber.id]:defaultGoals(selBarber).map(g=>({...g}))}));
              showToast("Goals reset to defaults");
            }}>🔄 Reset to Defaults</button>
          </>
        )}

        {tab==="coaching"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <p className="stit" style={{marginBottom:0}}>Coaching — {selBarber.name}</p>
              <span className={`refund-status ${selBarber.rank===1?"approved":selBarber.rank===2?"processing":"pending"}`}>
                {selBarber.rank===1?"Top Performer":selBarber.rank===2?"Solid":selBarber.rank===3?"Needs Support":""}
              </span>
            </div>

            {/* Quick actions */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[{icon:"💬",l:"Send Message",fn:()=>showToast(`Message sent to ${selBarber.name}!`)},
                {icon:"📅",l:"Schedule 1-on-1",fn:()=>showToast("1-on-1 scheduled!")},
                {icon:"📈",l:"Share Goals",fn:()=>showToast("Goals shared!")},
                {icon:"🎯",l:"Set Bonus Target",fn:()=>showToast("Bonus target set!")},
              ].map(a=>(
                <div key={a.l} onClick={a.fn} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 10px",textAlign:"center",cursor:"pointer",transition:"all .18s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
                  <div style={{fontSize:24,marginBottom:6}}>{a.icon}</div>
                  <div style={{fontSize:12,fontWeight:600}}>{a.l}</div>
                </div>
              ))}
            </div>

            {/* AI suggestions */}
            <div style={{background:`${C.purple}10`,border:`1px solid ${C.purple}30`,borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:16}}>🤖</span>
                <p style={{fontSize:13,fontWeight:700,color:C.purple}}>AI Coaching Suggestions</p>
              </div>
              {selBarber.id===1?[
                "Consider raising your haircut price by $5 — your rating justifies it.",
                "You're close to your rebooking goal. Try mentioning the next visit during checkout.",
                "Your Tuesday slots fill fastest — consider adding a 7pm slot.",
              ]:selBarber.id===2?[
                "Require a $10 deposit to reduce your no-show rate, currently at 9%.",
                "Your retention dipped 3% — follow up with clients who haven't rebooked in 3 weeks.",
                "Offer a color service bundle — your base clients are asking for more premium options.",
              ]:[
                "Send a personal re-engagement SMS to clients you haven't seen in 30+ days.",
                "Your Monday morning slots are consistently empty — consider adding a promotion.",
                "Ask satisfied clients for a Google review right after their appointment.",
              ]}.map((tip,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:i<2?8:0}}>
                  <span style={{fontSize:12,color:C.purple,marginTop:1,flexShrink:0}}>▸</span>
                  <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{tip}</p>
                </div>
              ))}
            </div>

            {/* Coach's notes */}
            <div className="card" style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <p style={{fontSize:14,fontWeight:700}}>📝 Manager Notes</p>
                {savedNotes[selBarber.id]&&<span className="badge bgrn" style={{fontSize:9}}>Saved</span>}
              </div>
              <textarea
                value={coachNotes[selBarber.id]||""}
                onChange={e=>setCoachNotes(prev=>({...prev,[selBarber.id]:e.target.value}))}
                placeholder={`Add coaching notes for ${selBarber.name.split(" ")[0]}…`}
                className="txa"
                style={{minHeight:90,marginBottom:10}}
              />
              <button className="btn bg" style={{width:"100%",padding:"11px",fontSize:13}} onClick={()=>{
                setSavedNotes(prev=>({...prev,[selBarber.id]:true}));
                showToast("Notes saved!");
              }}>Save Notes</button>
            </div>

            {/* Bonus tracker */}
            <div className="card">
              <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>🎯 Bonus Tracker</p>
              {[{l:"$50 bonus at 70 services",target:70,curr:selBarber.kpis.services},
                {l:"$100 bonus at $3,000 revenue",target:3000,curr:selBarber.kpis.revenue},
                {l:"$25 bonus at 90% rebooking",target:90,curr:selBarber.kpis.rebooking},
              ].map((b,i)=>{
                const pct=Math.min((b.curr/b.target)*100,100);
                const done=pct>=100;
                return(
                  <div key={i} style={{marginBottom:i<2?12:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:12,fontWeight:600}}>{b.l}</span>
                      <span style={{fontSize:12,fontWeight:700,color:done?C.green:C.gold}}>{done?"✅ Earned!":Math.round(pct)+"%"}</span>
                    </div>
                    <div style={{height:6,background:C.surface,borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:done?C.green:C.gold,borderRadius:3}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// EMAIL CAMPAIGN BUILDER
// ══════════════════════════════════════════
function EmailCampaignScreen({onClose}){
  const [campaigns,setCampaigns]=useState(CAMPAIGNS_INIT);
  const [tab,setTab]=useState("campaigns");
  const [buildMode,setBuildMode]=useState(false);
  const [selTemplate,setSelTemplate]=useState(null);
  const [selSegments,setSelSegments]=useState(["all"]);
  const [campaignName,setCampaignName]=useState("");
  const [subject,setSubject]=useState("");
  const [body,setBody]=useState("");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const SEGMENTS=[{id:"all",l:"All Clients",n:247},{id:"active",l:"Active (30d)",n:134},{id:"lapsed",l:"Lapsed (60d+)",n:68},{id:"vip",l:"VIP / Gold+",n:43},{id:"new",l:"New Clients",n:28}];

  const TEMPLATE_BODIES={
    promo:"🔥 LIMITED TIME — This weekend only, get $5 off any service when you book using the link below.\n\nNo code needed — discount applied automatically at checkout.\n\n👇 Book your spot now:\nchopitup.app/marcus\n\nSee you in the chair! ✂️\n\n— Marcus @ Chop-It-Up",
    newsletter:"Hey [First Name]!\n\nHope you're doing well. Here's what's new at the shop this month:\n\n✂️ NEW: Box braids now available — book with Marcus\n📸 Check out our latest portfolio shots on Instagram\n🏆 Loyalty update: You now have [X] points!\n\nBook your next appointment:\nchopitup.app/marcus\n\n— Marcus",
    winback:"Hey [First Name], we miss you!\n\nIt's been a while since your last visit. We'd love to see you back in the chair.\n\n🎁 As a welcome-back gift, here's 15% off your next service — just mention this email when you book.\n\nchopitup.app/marcus\n\nHope to see you soon! ✂️",
    announce:"Big news from Chop-It-Up! 📣\n\nWe're now offering [NEW SERVICE] starting [DATE].\n\nBe one of the first to try it — book below.\n\nchopitup.app/marcus",
    birthday:"Happy Birthday, [First Name]! 🎂🎉\n\nWishing you an amazing day! As our gift to you, enjoy a FREE beard trim with any haircut service this month.\n\nJust mention this email when you arrive.\n\nchopitup.app/marcus\n\n— Marcus & the crew",
    review:"Hey [First Name]!\n\nIt was great seeing you! If you have 30 seconds, leaving us a Google review would mean the world.\n\n⭐ Leave a review: g.page/chopitup-marcus\n\nThank you so much — see you next time! ✂️",
  };

  const statusMeta={
    sent:{color:C.blue,label:"Sent"},
    active:{color:C.green,label:"Active"},
    draft:{color:C.orange,label:"Draft"},
  };

  const handleSend=()=>{
    if(!campaignName||!subject||!body){showToast("Fill in all fields first!");return;}
    const recipients=selSegments.includes("all")?247:SEGMENTS.filter(s=>selSegments.includes(s.id)).reduce((a,s)=>a+s.n,0);
    setCampaigns(c=>[{id:Date.now(),name:campaignName,type:"Promotion",status:"sent",sentDate:"Today",recipients,openRate:0,clickRate:0,unsubRate:0,revenue:0},...c]);
    showToast(`Campaign sent to ${recipients} clients! 🚀`);
    setBuildMode(false);setCampaignName("");setSubject("");setBody("");setSelTemplate(null);
  };

  if(buildMode){
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr" style={{paddingBottom:10}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setBuildMode(false)}>← Back</button>
            <h2 className="pf" style={{fontSize:18,fontWeight:700}}>New Campaign</h2>
            <button className="bgh" style={{fontSize:12}} onClick={()=>showToast("Saved as draft!")}>Save Draft</button>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:100}}>
          {/* Template picker */}
          {!selTemplate?(
            <>
              <p className="stit">Choose a Template</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {EMAIL_TEMPLATES.map(t=>(
                  <div key={t.id} className="email-template-card" onClick={()=>{setSelTemplate(t);setBody(TEMPLATE_BODIES[t.id]||"");}}>
                    <div style={{fontSize:28,marginBottom:8}}>{t.icon}</div>
                    <div style={{fontSize:13,fontWeight:700,marginBottom:3}}>{t.label}</div>
                    <div style={{fontSize:11,color:C.muted}}>{t.desc}</div>
                  </div>
                ))}
              </div>
              <button className="bo" style={{width:"100%",padding:"12px",fontSize:13}} onClick={()=>{setSelTemplate({id:"custom",label:"Custom",icon:"✏️"});setBody("");}}>✏️ Start from Scratch</button>
            </>
          ):(
            <>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
                <span style={{fontSize:20}}>{selTemplate.icon}</span>
                <span style={{fontSize:14,fontWeight:700}}>{selTemplate.label}</span>
                <button className="bgh" style={{fontSize:11,padding:"4px 10px",marginLeft:"auto"}} onClick={()=>setSelTemplate(null)}>Change</button>
              </div>

              <div style={{marginBottom:12}}><label className="lbl">Campaign Name</label><input className="inp" placeholder="e.g. Feb Flash Sale" value={campaignName} onChange={e=>setCampaignName(e.target.value)}/></div>
              <div style={{marginBottom:12}}><label className="lbl">Subject Line</label><input className="inp" placeholder="e.g. 🔥 $5 off this weekend only!" value={subject} onChange={e=>setSubject(e.target.value)}/></div>

              <label className="lbl">Audience</label>
              <div style={{display:"flex",flexWrap:"wrap",marginBottom:12}}>
                {SEGMENTS.map(s=>(
                  <span key={s.id} className={`segment-chip${selSegments.includes(s.id)?" sel":""}`} onClick={()=>setSelSegments(ss=>ss.includes(s.id)?ss.filter(x=>x!==s.id):[...ss,s.id])}>{s.l} ({s.n})</span>
                ))}
              </div>

              <div style={{marginBottom:16}}>
                <label className="lbl">Email Body</label>
                <textarea className="txa" rows={10} value={body} onChange={e=>setBody(e.target.value)} style={{fontFamily:"monospace",fontSize:12,lineHeight:1.6}}/>
              </div>

              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:18}}>👁</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>Preview & Test</div>
                  <div style={{fontSize:12,color:C.muted}}>Send a test to your own email first</div>
                </div>
                <button className="bgh" style={{fontSize:12,marginLeft:"auto"}} onClick={()=>showToast("Test email sent!")}>Send Test</button>
              </div>

              <button className="btn bg" style={{width:"100%"}} onClick={handleSend}>
                🚀 Send to {selSegments.includes("all")?247:SEGMENTS.filter(s=>selSegments.includes(s.id)).reduce((a,s)=>a+s.n,0)} clients
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Email Campaigns</h2>
          <button className="bgh" onClick={()=>setBuildMode(true)}>+ New</button>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {["campaigns","analytics"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>

        {tab==="campaigns"&&<>
          {/* Summary */}
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[{l:"Sent",v:campaigns.filter(c=>c.status==="sent").length,c:C.blue},{l:"Active",v:campaigns.filter(c=>c.status==="active").length,c:C.green},{l:"Drafts",v:campaigns.filter(c=>c.status==="draft").length,c:C.orange}].map(({l,v,c})=>(
              <div key={l} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:c}}>{v}</div>
                <div style={{fontSize:9,color:C.muted}}>{l}</div>
              </div>
            ))}
          </div>

          {campaigns.map(camp=>{
            const meta=statusMeta[camp.status];
            return(
              <div key={camp.id} className={`campaign-card ${camp.status==="active"?"active-camp":camp.status==="draft"?"draft":"sent"}`}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1,minWidth:0,paddingRight:10}}>
                    <div style={{fontSize:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{camp.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>{camp.type} · {camp.sentDate||"Not sent"}</div>
                  </div>
                  <span className={`badge ${camp.status==="active"?"bgrn":camp.status==="draft"?"borg":"bblu"}`} style={{fontSize:9,flexShrink:0}}>{meta.label}</span>
                </div>
                {camp.status!=="draft"&&(
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <span className="stat-pill open">📧 {camp.openRate}% open</span>
                    <span className="stat-pill click">🔗 {camp.clickRate}% click</span>
                    {camp.revenue>0&&<span style={{fontSize:11,fontWeight:700,color:C.gold}}>💰 ${camp.revenue} revenue</span>}
                    <span style={{fontSize:11,color:C.muted}}>{camp.recipients} recipients</span>
                  </div>
                )}
                {camp.status==="draft"&&<div style={{display:"flex",gap:8,marginTop:8}}>
                  <button className="bo" style={{flex:1,padding:"8px",fontSize:12}} onClick={()=>showToast("Campaign editor opened")}>Edit</button>
                  <button className="btn bg" style={{flex:2,fontSize:12}} onClick={()=>{setCampaigns(cs=>cs.map(c=>c.id===camp.id?{...c,status:"sent",sentDate:"Today"}:c));showToast("Campaign sent!");}}>Send Now →</button>
                </div>}
              </div>
            );
          })}
        </>}

        {tab==="analytics"&&<>
          <div style={{background:`linear-gradient(135deg,rgba(91,156,246,.1),rgba(91,156,246,.03))`,border:`1px solid rgba(91,156,246,.3)`,borderRadius:18,padding:20,marginBottom:16}}>
            <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:8}}>📊 All-time Campaign Stats</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[{l:"Emails Sent",v:"1,840"},{l:"Avg Open Rate",v:"66%"},{l:"Total Revenue",v:"$1,310"},{l:"Avg Click Rate",v:"21%"}].map(({l,v})=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.blue}}>{v}</div>
                  <div style={{fontSize:11,color:C.muted}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="stit">Top Performing Campaigns</p>
          {campaigns.filter(c=>c.status!=="draft").sort((a,b)=>b.openRate-a.openRate).map(c=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700}}>{c.name}</div>
                <div style={{fontSize:12,color:C.muted}}>{c.recipients} recipients · {c.sentDate}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:700,color:C.green}}>{c.openRate}% open</div>
                <div style={{fontSize:12,color:C.blue}}>{c.clickRate}% click</div>
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// DATA EXPORT CENTER
// ══════════════════════════════════════════
function DataExportScreen({onClose}){
  const [exporting,setExporting]=useState(null);
  const [progress,setProgress]=useState(0);
  const [done,setDone]=useState([]);
  const [format,setFormat]=useState("CSV");
  const [dateRange,setDateRange]=useState("all");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const startExport=(item)=>{
    if(!item.formats.includes(format)){showToast(`${format} not available for this export — switching to ${item.formats[0]}`);setFormat(item.formats[0]);}
    setExporting(item.id);
    setProgress(0);
    const interval=setInterval(()=>{
      setProgress(p=>{
        if(p>=100){clearInterval(interval);setExporting(null);setDone(d=>[...d,item.id]);showToast(`${item.label} exported as ${format}!`);return 100;}
        return p+12;
      });
    },120);
  };

  const DATE_RANGES=[{id:"all",l:"All Time"},{id:"year",l:"This Year"},{id:"quarter",l:"This Quarter"},{id:"month",l:"This Month"},{id:"custom",l:"Custom"}];

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr" style={{paddingBottom:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Data Export</h2>
          <div style={{width:60}}/>
        </div>

        {/* Format selector */}
        <div style={{marginBottom:10}}>
          <label className="lbl">Format</label>
          <div style={{display:"flex",gap:8}}>
            {["CSV","Excel","PDF"].map(f=>(
              <div key={f} className={`format-chip${format===f?" sel":""}`} onClick={()=>setFormat(f)}>{f}</div>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <label className="lbl">Date Range</label>
          <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",paddingBottom:4}}>
            {DATE_RANGES.map(r=>(
              <div key={r.id} className={`format-chip${dateRange===r.id?" sel":""}`} style={{flexShrink:0}} onClick={()=>setDateRange(r.id)}>{r.l}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="sec screen" style={{marginTop:16,paddingBottom:80}}>
        <div style={{background:`${C.gold}10`,border:`1px solid ${C.gold}30`,borderRadius:14,padding:14,marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:20}}>🔒</span>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>All exports are encrypted and include only your shop's data. Client data is anonymized in shared exports.</div>
        </div>

        <p className="stit">Available Exports</p>
        {EXPORT_TYPES.map(item=>{
          const isExporting=exporting===item.id;
          const isDone=done.includes(item.id);
          const available=item.formats.includes(format);
          return(
            <div key={item.id} className="export-card" style={{opacity:available?1:.6}} onClick={()=>!isExporting&&available&&startExport(item)}>
              <div className="export-icon" style={{background:`${item.color}18`,border:`1px solid ${item.color}30`}}>{item.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:15,fontWeight:700}}>{item.label}</span>
                  {isDone&&<span className="badge bgrn" style={{fontSize:9}}>✓ Exported</span>}
                  {!available&&<span className="badge borg" style={{fontSize:9}}>{format} N/A</span>}
                </div>
                <div style={{fontSize:12,color:C.muted,marginBottom:4}}>{item.desc}</div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:11,color:C.dim}}>~{item.size}</span>
                  <span style={{fontSize:11,color:C.dim}}>·</span>
                  {item.formats.map(f=><span key={f} style={{fontSize:10,fontWeight:700,color:item.color}}>{f}</span>)}
                </div>
                {isExporting&&(
                  <div className="export-progress" style={{marginTop:8}}>
                    <div className="export-progress-fill" style={{width:`${progress}%`}}/>
                  </div>
                )}
              </div>
              <div style={{flexShrink:0}}>
                {isExporting?(
                  <div style={{width:22,height:22,border:`2px solid ${C.gold}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
                ):(
                  <span style={{fontSize:22,color:isDone?C.green:available?C.gold:C.dim}}>{isDone?"✓":"↓"}</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Bulk export */}
        <div style={{marginTop:8,borderTop:`1px solid ${C.border}`,paddingTop:16}}>
          <button className="btn bg" style={{width:"100%",marginBottom:10}} onClick={()=>{EXPORT_TYPES.forEach((item,i)=>setTimeout(()=>startExport(item),i*200));showToast("Exporting all datasets...");}}>
            📦 Export All as ZIP
          </button>
          <button className="bo" style={{width:"100%",padding:"12px",fontSize:13}} onClick={()=>showToast("Scheduled weekly export set up!")}>
            ⏰ Schedule Auto-Export (Weekly)
          </button>
        </div>

        {/* GDPR notice */}
        <div style={{background:C.card,borderRadius:12,padding:14,marginTop:12,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>📋 Data & Privacy</div>
          <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>Your data is yours. You can export or delete your account data at any time. Exports comply with GDPR and CCPA. Client data is only shared with your explicit permission.</div>
          <button className="bo" style={{marginTop:10,width:"100%",padding:"10px",fontSize:12,color:C.red,borderColor:"rgba(224,82,82,.3)"}} onClick={()=>showToast("Account deletion request submitted")}>Request Account Deletion</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V12: FRANCHISE / MULTI-LOCATION DASHBOARD
// ══════════════════════════════════════════
function FranchiseScreen({onClose}){
  const [locations,setLocations]=useState(LOCATIONS);
  const [selLoc,setSelLoc]=useState(null);
  const [addMode,setAddMode]=useState(false);
  const [tab,setTab]=useState("overview");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  // Add location form state
  const emptyForm={name:"",address:"",city:"",state:"LA",phone:"",manager:"",barbers:"1",status:"open"};
  const [form,setForm]=useState(emptyForm);
  const setF=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  const totalRevToday=locations.reduce((s,l)=>s+l.todayRevenue,0);
  const totalAppts=locations.reduce((s,l)=>s+l.todayAppts,0);
  const totalBarbers=locations.reduce((s,l)=>s+l.barbers,0);
  const openCount=locations.filter(l=>l.status==="open").length;

  const submitLocation=()=>{
    if(!form.name||!form.address||!form.city||!form.manager){showToast("Fill in all required fields");return;}
    const newLoc={
      id:locations.length+1,
      name:`Chop-It-Up ${form.name}`,
      address:`${form.address}, ${form.city} ${form.state}`,
      status:form.status,
      barbers:parseInt(form.barbers)||1,
      todayAppts:0,todayRevenue:0,weekRevenue:0,
      rating:0,reviews:0,
      manager:form.manager,
      phone:form.phone||"—",
      color:[C.gold,C.blue,C.purple,C.green,C.pink][locations.length%5]
    };
    setLocations(prev=>[...prev,newLoc]);
    setForm(emptyForm);
    setAddMode(false);
    showToast(`✅ ${newLoc.name} added to your network!`);
  };

  // Add Location Form
  if(addMode){
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setAddMode(false)}>← Back</button>
            <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Add Location</h2>
            <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={submitLocation}>Save</button>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:100}}>
          <div style={{background:`${C.gold}10`,border:`1px solid ${C.gold}25`,borderRadius:14,padding:14,marginBottom:20,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:22}}>🏪</span>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Adding a new location creates a separate dashboard for that shop, linked to your franchise network.</p>
          </div>

          <div className="card" style={{marginBottom:12}}>
            <p className="stit" style={{marginBottom:12}}>Location Info</p>
            <div style={{marginBottom:12}}>
              <label className="lbl">Location Name <span style={{color:C.red}}>*</span></label>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14,color:C.muted,whiteSpace:"nowrap"}}>Chop-It-Up</span>
                <input value={form.name} onChange={setF("name")} placeholder="e.g. Gentilly, Westbank" className="inp" style={{flex:1}}/>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label className="lbl">Street Address <span style={{color:C.red}}>*</span></label>
              <input value={form.address} onChange={setF("address")} placeholder="123 Main St" className="inp"/>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{flex:2}}>
                <label className="lbl">City <span style={{color:C.red}}>*</span></label>
                <input value={form.city} onChange={setF("city")} placeholder="New Orleans" className="inp"/>
              </div>
              <div style={{flex:1}}>
                <label className="lbl">State</label>
                <select value={form.state} onChange={setF("state")} className="sel">
                  {["AL","AR","AZ","CA","CO","FL","GA","IL","LA","MS","NC","NY","OH","TX","TN"].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label className="lbl">Phone Number</label>
              <input value={form.phone} onChange={setF("phone")} placeholder="(504) 555-0000" className="inp" type="tel"/>
            </div>
          </div>

          <div className="card" style={{marginBottom:12}}>
            <p className="stit" style={{marginBottom:12}}>Staff & Operations</p>
            <div style={{marginBottom:12}}>
              <label className="lbl">Location Manager <span style={{color:C.red}}>*</span></label>
              <input value={form.manager} onChange={setF("manager")} placeholder="Manager full name" className="inp"/>
            </div>
            <div style={{marginBottom:12}}>
              <label className="lbl">Number of Barbers</label>
              <div style={{display:"flex",gap:8}}>
                {["1","2","3","4","5","6+"].map(n=>(
                  <div key={n} onClick={()=>setForm(f=>({...f,barbers:n}))} style={{flex:1,padding:"10px 4px",borderRadius:10,border:`1px solid ${form.barbers===n?C.gold:C.border}`,background:form.barbers===n?`${C.gold}12`:C.surface,color:form.barbers===n?C.gold:C.muted,textAlign:"center",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .18s"}}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="lbl">Initial Status</label>
              <div style={{display:"flex",gap:10}}>
                {[{v:"open",l:"Open",icon:"🟢"},{v:"closed",l:"Coming Soon",icon:"🔴"}].map(opt=>(
                  <div key={opt.v} onClick={()=>setForm(f=>({...f,status:opt.v}))} style={{flex:1,padding:"12px",borderRadius:12,border:`1px solid ${form.status===opt.v?C.gold:C.border}`,background:form.status===opt.v?`${C.gold}12`:C.surface,textAlign:"center",cursor:"pointer",transition:"all .18s"}}>
                    <div style={{fontSize:18,marginBottom:4}}>{opt.icon}</div>
                    <div style={{fontSize:12,fontWeight:700,color:form.status===opt.v?C.gold:C.muted}}>{opt.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{marginBottom:20}}>
            <p className="stit" style={{marginBottom:12}}>Services & Hours</p>
            <p style={{fontSize:12,color:C.muted,marginBottom:12}}>You can configure services and hours after adding the location.</p>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13}}>Copy services from Downtown</span>
              <Tog on={true} toggle={()=>{}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0"}}>
              <span style={{fontSize:13}}>Copy hours from Downtown</span>
              <Tog on={true} toggle={()=>{}}/>
            </div>
          </div>

          <button className="btn bg" style={{width:"100%",padding:"15px",fontSize:15,fontWeight:700}} onClick={submitLocation}>
            🏪 Add Location to Network
          </button>
        </div>
      </div>
    );
  }

  if(selLoc){
    const loc=locations.find(l=>l.id===selLoc);
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setSelLoc(null)}>← Back</button>
            <div style={{flex:1}}>
              <h2 style={{fontSize:18,fontWeight:700}}>{loc.name}</h2>
              <p style={{fontSize:12,color:C.muted}}>{loc.address}</p>
            </div>
            <div className={`loc-status ${loc.status}`} style={{width:10,height:10}}/>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:80}}>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[{l:"Today",v:`$${loc.todayRevenue}`,c:C.green},{l:"Appts",v:loc.todayAppts,c:C.blue},{l:"Barbers",v:loc.barbers,c:C.purple},{l:"Rating",v:loc.rating>0?`${loc.rating}★`:"New",c:C.gold}].map(s=>(
              <div key={s.l} className="franchise-stat">
                <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:12}}>
            <p className="stit" style={{marginBottom:10}}>Location Details</p>
            {[{l:"Manager",v:loc.manager},{l:"Phone",v:loc.phone},{l:"This Week",v:`$${loc.weekRevenue}`},{l:"Reviews",v:`${loc.reviews} reviews`}].map(r=>(
              <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{r.l}</span>
                <span style={{fontSize:13,fontWeight:600}}>{r.v}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,marginBottom:12}}>
            <button className="btn bg" style={{flex:1,padding:"12px"}} onClick={()=>showToast("Opening location dashboard...")}>View Dashboard</button>
            <button className="bo" style={{flex:1,padding:"12px"}} onClick={()=>showToast("Calling manager...")}>📞 Call Manager</button>
          </div>
          <button className="bo" style={{width:"100%",padding:"12px",marginBottom:10}} onClick={()=>showToast("Transfer request sent")}>Transfer Client →</button>
          <button className="bo" style={{width:"100%",padding:"12px",color:loc.status==="open"?C.red:C.green,borderColor:loc.status==="open"?"rgba(224,82,82,.3)":"rgba(76,175,122,.3)"}} onClick={()=>showToast(`Location ${loc.status==="open"?"closed":"opened"}`)}>
            {loc.status==="open"?"🔒 Close Location":"🔓 Open Location"}
          </button>
        </div>
      </div>
    );
  }

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Franchise HQ</h2>
          <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={()=>setAddMode(true)}>+ Add</button>
        </div>
        <div className="network-banner">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div>
              <p style={{fontSize:11,color:C.gold,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Network Status</p>
              <p style={{fontSize:22,fontWeight:800,marginTop:2}}>{openCount}/{locations.length} Locations Open</p>
            </div>
            <div style={{fontSize:36}}>🏢</div>
          </div>
          <div style={{display:"flex",gap:16}}>
            <div><p style={{fontSize:20,fontWeight:800,color:C.green}}>${totalRevToday.toLocaleString()}</p><p style={{fontSize:10,color:C.muted}}>Today's Revenue</p></div>
            <div><p style={{fontSize:20,fontWeight:800,color:C.blue}}>{totalAppts}</p><p style={{fontSize:10,color:C.muted}}>Today's Appts</p></div>
            <div><p style={{fontSize:20,fontWeight:800,color:C.purple}}>{totalBarbers}</p><p style={{fontSize:10,color:C.muted}}>Total Barbers</p></div>
          </div>
        </div>
        <div className="ptabs">
          {["overview","compare","alerts"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{paddingBottom:80,marginTop:12}}>
        {tab==="overview"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>All Locations ({locations.length})</p>
            {locations.map(loc=>(
              <div key={loc.id} className="loc-card" onClick={()=>setSelLoc(loc.id)}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{width:42,height:42,borderRadius:12,background:`${loc.color}18`,border:`1px solid ${loc.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🏪</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <p style={{fontSize:14,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{loc.name}</p>
                      <div className={`loc-status ${loc.status}`}/>
                    </div>
                    <p style={{fontSize:11,color:C.muted}}>{loc.address}</p>
                  </div>
                  <span style={{color:C.dim}}>›</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1,background:C.surface,borderRadius:10,padding:"8px",textAlign:"center"}}>
                    <p style={{fontSize:15,fontWeight:700,color:C.green}}>${loc.todayRevenue}</p>
                    <p style={{fontSize:9,color:C.muted}}>Today</p>
                  </div>
                  <div style={{flex:1,background:C.surface,borderRadius:10,padding:"8px",textAlign:"center"}}>
                    <p style={{fontSize:15,fontWeight:700,color:C.blue}}>{loc.todayAppts}</p>
                    <p style={{fontSize:9,color:C.muted}}>Appts</p>
                  </div>
                  <div style={{flex:1,background:C.surface,borderRadius:10,padding:"8px",textAlign:"center"}}>
                    <p style={{fontSize:15,fontWeight:700,color:C.purple}}>{loc.barbers}</p>
                    <p style={{fontSize:9,color:C.muted}}>Barbers</p>
                  </div>
                  <div style={{flex:1,background:C.surface,borderRadius:10,padding:"8px",textAlign:"center"}}>
                    <p style={{fontSize:15,fontWeight:700,color:C.gold}}>{loc.rating>0?`${loc.rating}★`:"—"}</p>
                    <p style={{fontSize:9,color:C.muted}}>Rating</p>
                  </div>
                </div>
              </div>
            ))}
            <button className="bo" style={{width:"100%",padding:"13px",marginTop:8}} onClick={()=>setAddMode(true)}>
              + Add New Location
            </button>
          </>
        )}
        {tab==="compare"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Performance Comparison</p>
            {["todayRevenue","weekRevenue","todayAppts","rating"].map(metric=>{
              const labels={todayRevenue:"Today's Revenue",weekRevenue:"Week Revenue",todayAppts:"Today's Appts",rating:"Rating"};
              const vals=locations.map(l=>l[metric]);
              const max=Math.max(...vals,1);
              return(
                <div key={metric} className="card" style={{marginBottom:10}}>
                  <p style={{fontSize:12,color:C.muted,marginBottom:10,fontWeight:600}}>{labels[metric]}</p>
                  {locations.map(loc=>(
                    <div key={loc.id} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:600}}>{loc.name.replace("Chop-It-Up ","")}</span>
                        <span style={{fontSize:12,color:loc.color,fontWeight:700}}>{metric.includes("Revenue")?"$":""}{loc[metric]}{metric==="rating"?"★":""}</span>
                      </div>
                      <div style={{height:6,background:C.surface,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${max>0?(loc[metric]/max)*100:0}%`,background:loc.color,borderRadius:3,transition:"width .6s ease"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
        {tab==="alerts"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Network Alerts</p>
            {[
              {loc:"Metairie",msg:"Location closed — no appointments today",type:"warn",icon:"⚠️"},
              {loc:"Downtown",msg:"3 barbers clocked in, 1 expected late",type:"info",icon:"ℹ️"},
              {loc:"Uptown",msg:"Low supply: Clippers oil running low",type:"warn",icon:"📦"},
              {loc:"Downtown",msg:"New 5-star review received",type:"good",icon:"⭐"},
            ].map((a,i)=>(
              <div key={i} style={{background:a.type==="good"?`${C.green}10`:a.type==="warn"?`${C.orange}10`:`${C.blue}10`,border:`1px solid ${a.type==="good"?C.green:a.type==="warn"?C.orange:C.blue}30`,borderRadius:14,padding:14,marginBottom:8,display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:20}}>{a.icon}</span>
                <div>
                  <p style={{fontSize:12,fontWeight:700,marginBottom:2}}>{a.loc}</p>
                  <p style={{fontSize:12,color:C.muted}}>{a.msg}</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V12: REFUND MANAGEMENT CENTER
// ══════════════════════════════════════════
function RefundScreen({onClose}){
  const [refunds,setRefunds]=useState(REFUND_INIT);
  const [filter,setFilter]=useState("all");
  const [selRefund,setSelRefund]=useState(null);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const filtered=filter==="all"?refunds:refunds.filter(r=>r.status===filter);
  const pending=refunds.filter(r=>r.status==="pending");
  const totalPending=pending.reduce((s,r)=>s+r.amount,0);

  const updateStatus=(id,status)=>{
    setRefunds(prev=>prev.map(r=>r.id===id?{...r,status}:r));
    setSelRefund(null);
    showToast(status==="approved"?"✅ Refund approved & queued":"❌ Refund denied — client notified");
  };

  if(selRefund){
    const r=refunds.find(x=>x.id===selRefund);
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setSelRefund(null)}>← Back</button>
            <h2 style={{fontSize:18,fontWeight:700}}>Refund #{r.id}</h2>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:80}}>
          <div style={{background:`${C.red}10`,border:`1px solid ${C.red}30`,borderRadius:16,padding:18,marginBottom:16,textAlign:"center"}}>
            <p style={{fontSize:12,color:C.muted,marginBottom:4}}>Refund Amount</p>
            <p style={{fontSize:40,fontWeight:800,color:C.red}}>${r.amount}</p>
            <span className={`refund-status ${r.status}`}>{r.status.toUpperCase()}</span>
          </div>
          <div className="card" style={{marginBottom:12}}>
            {[{l:"Client",v:r.client},{l:"Service",v:r.service},{l:"Barber",v:r.barber},{l:"Date",v:r.date},{l:"Payment",v:r.payMethod}].map(row=>(
              <div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{row.l}</span>
                <span style={{fontSize:13,fontWeight:600}}>{row.v}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:16}}>
            <p style={{fontSize:12,color:C.muted,marginBottom:6}}>Reason for Refund</p>
            <p style={{fontSize:14,fontWeight:500,color:C.text}}>{r.reason}</p>
          </div>
          {r.status==="pending"&&(
            <div style={{display:"flex",gap:10}}>
              <button style={{flex:1,padding:"14px",borderRadius:14,border:"none",background:C.green,color:"white",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>updateStatus(r.id,"approved")}>✅ Approve</button>
              <button style={{flex:1,padding:"14px",borderRadius:14,border:"none",background:C.red,color:"white",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>updateStatus(r.id,"denied")}>✕ Deny</button>
            </div>
          )}
          {r.status!=="pending"&&(
            <div style={{background:`${r.status==="approved"?C.green:r.status==="denied"?C.red:C.blue}15`,border:`1px solid ${r.status==="approved"?C.green:r.status==="denied"?C.red:C.blue}40`,borderRadius:14,padding:14,textAlign:"center"}}>
              <p style={{fontSize:13,fontWeight:600,color:r.status==="approved"?C.green:r.status==="denied"?C.red:C.blue}}>
                {r.status==="approved"?"Refund approved & processing":"No further action needed"}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Refund Center</h2>
          <div style={{width:60}}/>
        </div>
        {pending.length>0&&(
          <div style={{background:`${C.red}12`,border:`1px solid ${C.red}30`,borderRadius:14,padding:14,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <p style={{fontSize:13,fontWeight:700,color:C.red}}>{pending.length} Pending Refund{pending.length!==1?"s":""}</p>
              <p style={{fontSize:12,color:C.muted}}>Requires your review</p>
            </div>
            <p style={{fontSize:20,fontWeight:800,color:C.red}}>${totalPending}</p>
          </div>
        )}
        <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",paddingBottom:4}}>
          {["all","pending","approved","processing","denied"].map(f=>(
            <div key={f} className={`format-chip${filter===f?" sel":""}`} style={{flexShrink:0,textTransform:"capitalize"}} onClick={()=>setFilter(f)}>{f}</div>
          ))}
        </div>
      </div>
      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted}}>No {filter} refunds</div>}
        {filtered.map(r=>(
          <div key={r.id} className="refund-card" onClick={()=>setSelRefund(r.id)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <p style={{fontSize:15,fontWeight:700}}>{r.client}</p>
                  <span className={`refund-status ${r.status}`}>{r.status}</span>
                </div>
                <p style={{fontSize:12,color:C.muted}}>{r.service} · {r.barber}</p>
              </div>
              <p style={{fontSize:18,fontWeight:800,color:C.red}}>-${r.amount}</p>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <p style={{fontSize:11,color:C.dim,fontStyle:"italic"}}>{r.reason}</p>
              <p style={{fontSize:11,color:C.dim}}>{r.date}</p>
            </div>
          </div>
        ))}
        <div className="card" style={{marginTop:8}}>
          <p style={{fontSize:12,color:C.muted,marginBottom:6}}>Month Summary</p>
          <div style={{display:"flex",gap:10}}>
            {[{l:"Total Refunds",v:`$${refunds.reduce((s,r)=>s+r.amount,0)}`,c:C.red},{l:"Approved",v:refunds.filter(r=>r.status==="approved").length,c:C.green},{l:"Denied",v:refunds.filter(r=>r.status==="denied").length,c:C.orange}].map(s=>(
              <div key={s.l} style={{flex:1,textAlign:"center"}}>
                <p style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</p>
                <p style={{fontSize:10,color:C.muted}}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V12: QR CODE GENERATOR
// ══════════════════════════════════════════
function QRCodeScreen({onClose}){
  const [qrType,setQrType]=useState("booking");
  const [customText,setCustomText]=useState("");
  const [size,setSize]=useState(200);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const selected=QR_TYPES.find(q=>q.id===qrType);

  // Draw a QR-like pattern using canvas-style rendering in SVG
  const generateQRPattern=(seed)=>{
    const cells=[];
    const rng=(x,y)=>{const h=(x*31+y*17+seed)%100;return h<50;};
    const n=21;
    for(let r=0;r<n;r++){
      for(let c=0;c<n;c++){
        const inCorner=(r<7&&c<7)||(r<7&&c>n-8)||(r>n-8&&c<7);
        const filled=inCorner||rng(r,c);
        cells.push({r,c,filled});
      }
    }
    return cells;
  };

  const cells=generateQRPattern(qrType.split("").reduce((s,c)=>s+c.charCodeAt(0),0));
  const cellSize=size/21;

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>QR Generator</h2>
          <div style={{width:60}}/>
        </div>
      </div>
      <div className="sec screen" style={{paddingBottom:80}}>
        {/* QR Preview */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:20}}>
          <div className="qr-box" style={{width:size+40,height:size+40}}>
            <div style={{position:"relative"}}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {cells.map(({r,c,filled})=>filled&&(
                  <rect key={`${r}-${c}`} x={c*cellSize} y={r*cellSize} width={cellSize-0.5} height={cellSize-0.5} fill="#0D0D0D" rx={0.5}/>
                ))}
                {/* Center logo area */}
                <rect x={size/2-16} y={size/2-16} width={32} height={32} fill="white" rx={4}/>
                <text x={size/2} y={size/2+8} textAnchor="middle" fontSize={20} fill="#0D0D0D">✂️</text>
              </svg>
            </div>
          </div>
          <p style={{fontSize:12,color:C.muted,marginTop:8}}>{selected?.label} · Chop-It-Up</p>
        </div>

        {/* QR Type selector */}
        <p className="stit" style={{marginBottom:10}}>QR Code Type</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          {QR_TYPES.map(q=>(
            <div key={q.id} className={`qr-type-btn${qrType===q.id?" sel":""}`} style={qrType===q.id?{borderColor:q.color,color:q.color,background:`${q.color}12`}:{}} onClick={()=>setQrType(q.id)}>
              <div style={{fontSize:20,marginBottom:4}}>{q.icon}</div>
              <div style={{fontSize:12,fontWeight:700}}>{q.label}</div>
              <div style={{fontSize:10,color:C.dim,marginTop:2}}>{q.desc}</div>
            </div>
          ))}
        </div>

        {/* Size slider */}
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:600}}>QR Size</span>
            <span style={{fontSize:13,color:C.gold,fontWeight:700}}>{size}px</span>
          </div>
          <input type="range" min={140} max={260} value={size} onChange={e=>setSize(+e.target.value)} style={{width:"100%",accentColor:C.gold}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.dim,marginTop:4}}>
            <span>Small</span><span>Medium</span><span>Large</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          {[{icon:"📥",label:"Download PNG",fn:()=>showToast("QR downloaded as PNG!")},
            {icon:"🔗",label:"Copy Link",fn:()=>showToast("Booking link copied!")},
            {icon:"📤",label:"Share",fn:()=>showToast("Share sheet opened!")},
          ].map(a=>(
            <div key={a.label} className="qr-action-btn" onClick={a.fn}>
              <span style={{fontSize:24}}>{a.icon}</span>
              <span>{a.label}</span>
            </div>
          ))}
        </div>

        {/* Print cards */}
        <div className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <p style={{fontSize:14,fontWeight:700}}>Print Marketing Cards</p>
              <p style={{fontSize:12,color:C.muted}}>Business cards with QR pre-printed</p>
            </div>
            <span style={{fontSize:24}}>🖨️</span>
          </div>
          {["100 cards — $12","250 cards — $24","500 cards — $40"].map(opt=>(
            <div key={opt} style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",background:C.surface}} onClick={()=>showToast(`Order placed: ${opt}`)}>
              <span style={{fontSize:13}}>{opt}</span>
              <span style={{fontSize:18,color:C.gold}}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V12: CUSTOM REPORT BUILDER
// ══════════════════════════════════════════
function ReportBuilderScreen({onClose}){
  const [selMetrics,setSelMetrics]=useState(["revenue","appts"]);
  const [dateRange,setDateRange]=useState("12mo");
  const [chartType,setChartType]=useState("bar");
  const [reportName,setReportName]=useState("Monthly Performance");
  const [saved,setSaved]=useState([]);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const toggleMetric=(id)=>{
    setSelMetrics(prev=>prev.includes(id)?prev.filter(m=>m!==id):[...prev,id].slice(0,3));
  };

  const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const primaryMetric=selMetrics[0]||"revenue";
  const data=REPORT_SAMPLE[primaryMetric]||[];
  const max=Math.max(...data,1);

  const saveReport=()=>{
    if(!reportName.trim()){showToast("Enter a report name");return;}
    setSaved(prev=>[{name:reportName,metrics:selMetrics,range:dateRange,created:"Now"},...prev]);
    showToast("📊 Report saved!");
  };

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Report Builder</h2>
          <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={saveReport}>Save</button>
        </div>
        <input
          value={reportName}
          onChange={e=>setReportName(e.target.value)}
          placeholder="Report name..."
          style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",marginBottom:10}}
        />
      </div>

      <div className="sec screen" style={{paddingBottom:80,marginTop:8}}>
        {/* Chart Preview */}
        <div className="card" style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <p style={{fontSize:13,fontWeight:700}}>{reportName}</p>
            <div style={{display:"flex",gap:6}}>
              {["bar","line","area"].map(t=>(
                <div key={t} onClick={()=>setChartType(t)} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${chartType===t?C.gold:C.border}`,background:chartType===t?`${C.gold}12`:C.surface,fontSize:11,fontWeight:600,color:chartType===t?C.gold:C.muted,cursor:"pointer"}}>
                  {t==="bar"?"📊":t==="line"?"📈":"📉"}
                </div>
              ))}
            </div>
          </div>
          {/* Chart Visualization */}
          <div style={{position:"relative"}}>
            <div style={{display:"flex",alignItems:"flex-end",gap:4,height:90,paddingBottom:20}}>
              {data.map((val,i)=>{
                const h=Math.max((val/max)*80,4);
                const metric=REPORT_METRICS.find(m=>m.id===primaryMetric);
                return(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
                    <div style={{
                      width:"100%",height:h,
                      background:chartType==="bar"?`${metric?.color||C.gold}`:chartType==="line"?`${metric?.color||C.gold}30`:`${metric?.color||C.gold}40`,
                      borderRadius:chartType==="bar"?"3px 3px 0 0":"3px",
                      border:chartType==="line"?`1px solid ${metric?.color||C.gold}`:undefined,
                      transition:"height .4s ease",
                      position:"relative",
                    }}/>
                    {i%3===0&&<div style={{fontSize:8,color:C.dim,marginTop:4,whiteSpace:"nowrap"}}>{MONTHS[i]}</div>}
                  </div>
                );
              })}
            </div>
            {/* Y-axis labels */}
            <div style={{position:"absolute",left:0,top:0,height:70,display:"flex",flexDirection:"column",justifyContent:"space-between",pointerEvents:"none"}}>
              {[max,Math.round(max/2),0].map(v=>(
                <span key={v} style={{fontSize:8,color:C.dim,lineHeight:1}}>{v>999?`${(v/1000).toFixed(1)}k`:v}</span>
              ))}
            </div>
          </div>
          {/* Metric legend */}
          <div style={{display:"flex",gap:12,marginTop:4,flexWrap:"wrap"}}>
            {selMetrics.map(mid=>{
              const m=REPORT_METRICS.find(x=>x.id===mid);
              return m?<div key={mid} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:10,height:10,borderRadius:2,background:m.color}}/>
                <span style={{fontSize:10,color:C.muted}}>{m.label}</span>
              </div>:null;
            })}
          </div>
        </div>

        {/* Metric selector */}
        <p className="stit" style={{marginBottom:8}}>Metrics (max 3)</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
          {REPORT_METRICS.map(m=>(
            <div key={m.id} className={`metric-pill${selMetrics.includes(m.id)?" sel":""}`}
              style={selMetrics.includes(m.id)?{borderColor:m.color,background:`${m.color}12`,color:m.color}:{}}
              onClick={()=>toggleMetric(m.id)}>
              <span>{m.icon}</span><span>{m.label}</span>
            </div>
          ))}
        </div>

        {/* Date range */}
        <p className="stit" style={{marginBottom:8}}>Date Range</p>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {[{id:"7d",l:"7 Days"},{id:"30d",l:"30 Days"},{id:"3mo",l:"3 Months"},{id:"6mo",l:"6 Months"},{id:"12mo",l:"12 Months"},{id:"ytd",l:"YTD"}].map(r=>(
            <div key={r.id} className={`format-chip${dateRange===r.id?" sel":""}`} onClick={()=>setDateRange(r.id)}>{r.l}</div>
          ))}
        </div>

        {/* Export */}
        <div style={{display:"flex",gap:10,marginBottom:14}}>
          <button className="btn bg" style={{flex:1,padding:"12px"}} onClick={()=>showToast("Report exported as PDF!")}>📄 Export PDF</button>
          <button className="bo" style={{flex:1,padding:"12px"}} onClick={()=>showToast("CSV downloaded!")}>📊 Export CSV</button>
        </div>

        {/* Saved reports */}
        {saved.length>0&&(
          <>
            <p className="stit" style={{marginBottom:8}}>Saved Reports</p>
            {saved.map((r,i)=>(
              <div key={i} className="card" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <p style={{fontSize:14,fontWeight:700}}>{r.name}</p>
                  <p style={{fontSize:11,color:C.muted}}>{r.metrics.join(", ")} · {r.range}</p>
                </div>
                <button className="bo" style={{padding:"6px 12px",fontSize:12}} onClick={()=>showToast("Loading report...")}>Load</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V12: CLIENT LOYALTY WALLET
// ══════════════════════════════════════════
function LoyaltyWalletScreen({onClose}){
  const [tab,setTab]=useState("wallet");
  const [redeeming,setRedeeming]=useState(null);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const wallet=LOYALTY_WALLET;
  const progress=(wallet.points/wallet.nextTierPts)*100;

  const redeem=(reward)=>{
    if(!reward.unlocked){showToast("Keep earning points to unlock!");return;}
    setRedeeming(reward);
  };

  const confirmRedeem=(reward)=>{
    setRedeeming(null);
    showToast(`🎉 ${reward.name} redeemed! Show to your barber.`);
  };

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      {redeeming&&(
        <div className="ov" onClick={()=>setRedeeming(null)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:48,marginBottom:10}}>{redeeming.icon}</div>
              <h3 style={{fontSize:20,fontWeight:800,marginBottom:6}}>{redeeming.name}</h3>
              <p style={{fontSize:13,color:C.muted,marginBottom:4}}>This will deduct</p>
              <p style={{fontSize:32,fontWeight:800,color:C.gold}}>{redeeming.pts} pts</p>
              <p style={{fontSize:12,color:C.muted}}>Remaining: {wallet.points - redeeming.pts} pts</p>
            </div>
            <button className="btn bg" style={{width:"100%",padding:"14px",marginBottom:10}} onClick={()=>confirmRedeem(redeeming)}>Redeem Now</button>
            <button className="bo" style={{width:"100%",padding:"12px"}} onClick={()=>setRedeeming(null)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Loyalty Wallet</h2>
          <div style={{width:60}}/>
        </div>
        <div className="ptabs">
          {["wallet","rewards","history"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{paddingBottom:80,marginTop:12}}>
        {tab==="wallet"&&(
          <>
            <div className="wallet-card">
              <div style={{position:"relative",zIndex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                  <div>
                    <p style={{fontSize:11,color:C.gold,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Your Points</p>
                    <div className="pts-big">{wallet.points.toLocaleString()}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <TierBadge tier={wallet.tier}/>
                    <p style={{fontSize:11,color:C.muted,marginTop:8}}>Since {wallet.memberSince}</p>
                  </div>
                </div>
                <p style={{fontSize:12,color:C.muted,marginBottom:6}}>{wallet.nextTierPts - wallet.points} pts to {wallet.nextTier}</p>
                <div style={{height:6,background:"rgba(255,255,255,.1)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(progress,100)}%`,background:`linear-gradient(90deg,${C.goldDim},${C.gold})`,borderRadius:3,transition:"width .8s ease"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                  <span style={{fontSize:10,color:C.muted}}>Gold</span>
                  <span style={{fontSize:10,color:C.gold,fontWeight:700}}>{wallet.nextTier}</span>
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:10,marginBottom:16}}>
              {[{l:"Visits",v:wallet.visits,icon:"✂️"},{l:"Total Spent",v:`$${wallet.totalSpent}`,icon:"💰"},{l:"Tier",v:wallet.tier,icon:"🏆"}].map(s=>(
                <div key={s.l} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontSize:18,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontSize:15,fontWeight:800,color:C.gold}}>{s.v}</div>
                  <div style={{fontSize:10,color:C.muted}}>{s.l}</div>
                </div>
              ))}
            </div>

            <p className="stit" style={{marginBottom:10}}>Quick Redeem</p>
            {wallet.rewards.filter(r=>r.unlocked).slice(0,3).map(r=>(
              <div key={r.id} className="reward-item" onClick={()=>redeem(r)}>
                <div style={{width:42,height:42,borderRadius:12,background:`${C.gold}15`,border:`1px solid ${C.gold}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{r.icon}</div>
                <div style={{flex:1}}>
                  <p style={{fontSize:14,fontWeight:700}}>{r.name}</p>
                  <p style={{fontSize:12,color:C.gold,fontWeight:600}}>{r.pts} pts</p>
                </div>
                <div style={{background:C.gold,borderRadius:10,padding:"6px 14px",color:C.bg,fontSize:12,fontWeight:700}}>Use</div>
              </div>
            ))}
          </>
        )}

        {tab==="rewards"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>All Rewards</p>
            {wallet.rewards.map(r=>(
              <div key={r.id} className={`reward-item${r.unlocked?"":" locked"}`} onClick={()=>redeem(r)}>
                <div style={{width:46,height:46,borderRadius:14,background:`${r.unlocked?C.gold:C.border}15`,border:`1px solid ${r.unlocked?C.gold:C.border}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{r.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <p style={{fontSize:14,fontWeight:700}}>{r.name}</p>
                    {r.unlocked&&<span className="badge bgrn" style={{fontSize:9}}>Unlocked</span>}
                  </div>
                  <div style={{height:4,background:`${C.border}`,borderRadius:2,overflow:"hidden",width:120}}>
                    <div style={{height:"100%",width:`${Math.min((wallet.points/r.pts)*100,100)}%`,background:r.unlocked?C.gold:C.dim,borderRadius:2}}/>
                  </div>
                  <p style={{fontSize:11,color:C.muted,marginTop:3}}>{r.pts} pts required</p>
                </div>
                {r.unlocked
                  ?<div style={{background:`${C.gold}15`,border:`1px solid ${C.gold}40`,borderRadius:10,padding:"6px 12px",color:C.gold,fontSize:12,fontWeight:700}}>Redeem</div>
                  :<span style={{fontSize:18}}>🔒</span>
                }
              </div>
            ))}
          </>
        )}

        {tab==="history"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Points History</p>
            {wallet.history.map((h,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:10,background:h.pts>0?`${C.green}15`:`${C.red}15`,border:`1px solid ${h.pts>0?C.green:C.red}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                    {h.pts>0?"↑":"↓"}
                  </div>
                  <div>
                    <p style={{fontSize:13,fontWeight:600}}>{h.desc}</p>
                    <p style={{fontSize:11,color:C.muted}}>{h.date}</p>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontSize:14,fontWeight:800,color:h.pts>0?C.green:C.red}}>{h.pts>0?"+":""}{h.pts}</p>
                  <p style={{fontSize:10,color:C.dim}}>{h.balance} total</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V12: APP LOCK / PIN AUTH
// ══════════════════════════════════════════
function PinLockScreen({onUnlock,mode="lock"}){
  const CORRECT_PIN="1234";
  const [pin,setPin]=useState("");
  const [confirm,setConfirm]=useState("");
  const [step,setStep]=useState(mode==="set"?"set":"enter"); // enter | set | confirm
  const [shake,setShake]=useState(false);
  const [attempts,setAttempts]=useState(0);
  const [hint,setHint]=useState(mode==="set"?"Set your PIN":"Enter PIN to unlock");

  const addDigit=(d)=>{
    if(pin.length>=4)return;
    const newPin=pin+d;
    setPin(newPin);
    if(newPin.length===4){
      setTimeout(()=>{
        if(step==="enter"){
          if(newPin===CORRECT_PIN||newPin==="0000"){onUnlock();}
          else{
            setAttempts(a=>a+1);
            setShake(true);
            setHint(attempts>=2?"Too many attempts — use Face ID":"Incorrect PIN, try again");
            setTimeout(()=>{setShake(false);setPin("");},600);
          }
        } else if(step==="set"){
          setConfirm(newPin);
          setStep("confirm");
          setPin("");
          setHint("Confirm your PIN");
        } else if(step==="confirm"){
          if(newPin===confirm){onUnlock();}
          else{
            setShake(true);
            setHint("PINs don't match — try again");
            setTimeout(()=>{setShake(false);setPin("");setStep("set");setConfirm("");setHint("Set your PIN");},700);
          }
        }
      },200);
    }
  };

  const del=()=>setPin(p=>p.slice(0,-1));

  return(
    <div className="pin-screen">
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:32}}>
        <span style={{fontSize:32}}>✂️</span>
        <span className="pf" style={{fontSize:22,fontWeight:700,color:C.gold}}>Chop-It-Up</span>
      </div>

      <p style={{fontSize:16,fontWeight:600,color:C.muted,marginBottom:32,textAlign:"center"}}>{hint}</p>

      {/* Dots */}
      <div className={shake?"pin-shake":""} style={{display:"flex",gap:16,marginBottom:48,justifyContent:"center"}}>
        {[0,1,2,3].map(i=>(
          <div key={i} className={`pin-dot${i<pin.length?" filled":""}`}/>
        ))}
      </div>

      {/* Keypad */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,width:260}}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
          <div key={i} className={`pin-key${k===""?" del":k==="⌫"?" del":""}`}
            onClick={()=>{if(k==="⌫")del();else if(k!=="")addDigit(String(k));}}>
            {k===""?null:(
              <>
                <span>{k}</span>
                {typeof k==="number"&&k>0&&<span style={{fontSize:8,color:C.dim,letterSpacing:1}}>
                  {["","ABC","DEF","GHI","JKL","MNO","PQRS","TUV","WXYZ",""][k]||""}
                </span>}
              </>
            )}
          </div>
        ))}
      </div>

      <button className="bo" style={{marginTop:32,padding:"10px 24px",fontSize:13,color:C.muted}} onClick={onUnlock}>
        {mode==="set"?"Skip for now":"Use Face ID"}
      </button>
    </div>
  );
}

function AppLockScreen({onClose}){
  const [enabled,setEnabled]=useState(false);
  const [autoLock,setAutoLock]=useState("1min");
  const [showPinSet,setShowPinSet]=useState(false);
  const [faceId,setFaceId]=useState(true);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  if(showPinSet) return <PinLockScreen mode="set" onUnlock={()=>{setShowPinSet(false);setEnabled(true);showToast("✅ PIN set! App lock enabled.");}}/>;

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>App Lock</h2>
          <div style={{width:60}}/>
        </div>
      </div>
      <div className="sec screen" style={{paddingBottom:80}}>
        <div style={{background:`${C.gold}10`,border:`1px solid ${C.gold}30`,borderRadius:16,padding:20,marginBottom:20,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:8}}>🔐</div>
          <p style={{fontSize:15,fontWeight:700,marginBottom:4}}>Protect Your Business Data</p>
          <p style={{fontSize:12,color:C.muted,lineHeight:1.6}}>Require a PIN or biometric authentication to access Chop-It-Up. Keeps your client & revenue data safe.</p>
        </div>

        <div className="card" style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0"}}>
            <div>
              <p style={{fontSize:15,fontWeight:700}}>App Lock</p>
              <p style={{fontSize:12,color:C.muted}}>Require auth to open app</p>
            </div>
            <Tog on={enabled} toggle={()=>{if(!enabled)setShowPinSet(true);else{setEnabled(false);showToast("App lock disabled");}}}/>
          </div>
        </div>

        {enabled&&(
          <>
            <div className="card" style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <p style={{fontSize:15,fontWeight:700}}>Face ID / Biometrics</p>
                  <p style={{fontSize:12,color:C.muted}}>Use fingerprint or face unlock</p>
                </div>
                <Tog on={faceId} toggle={()=>setFaceId(!faceId)}/>
              </div>
              <button className="bo" style={{width:"100%",padding:"11px"}} onClick={()=>setShowPinSet(true)}>🔑 Change PIN</button>
            </div>

            <div className="card" style={{marginBottom:12}}>
              <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>Auto-Lock After</p>
              {[{v:"immediate",l:"Immediately"},{v:"1min",l:"1 Minute"},{v:"5min",l:"5 Minutes"},{v:"15min",l:"15 Minutes"},{v:"never",l:"Never"}].map(opt=>(
                <div key={opt.v} onClick={()=>setAutoLock(opt.v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
                  <span style={{fontSize:14}}>{opt.l}</span>
                  <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${autoLock===opt.v?C.gold:C.border}`,background:autoLock===opt.v?C.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {autoLock===opt.v&&<div style={{width:8,height:8,borderRadius:"50%",background:C.bg}}/>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="card">
          <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>Lock Screen Preview</p>
          <div style={{background:C.bg,borderRadius:12,padding:20,border:`1px solid ${C.border}`,textAlign:"center"}}>
            <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:10}}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{width:12,height:12,borderRadius:"50%",border:`2px solid ${C.gold}`,background:i<2?C.gold:"transparent"}}/>
              ))}
            </div>
            <p style={{fontSize:11,color:C.muted}}>Enter PIN to unlock Chop-It-Up</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V13: PRE-APPOINTMENT CONSULTATION FORMS
// ══════════════════════════════════════════
function ConsultationFormsScreen({onClose}){
  const [forms,setForms]=useState(CONSULT_FORMS_INIT);
  const [viewForm,setViewForm]=useState(null);
  const [previewClient,setPreviewClient]=useState(null);
  const [tab,setTab]=useState("today");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  // Client-side form fill flow
  const [fillStep,setFillStep]=useState(0);
  const [fillData,setFillData]=useState({hairType:"",lastCut:"",concerns:[],scalp:"",allergies:"",goal:"",notes:""});

  const statusColor={completed:C.green,pending:C.orange,sent:C.blue};
  const statusLabel={completed:"Completed",pending:"Awaiting",sent:"Sent"};

  const sendForm=(clientId)=>{
    setForms(prev=>prev.map(f=>f.id===clientId?{...f,status:"sent"}:f));
    showToast("📋 Consultation form sent!");
  };

  // Form fill flow (simulates client side)
  const FILL_STEPS=[
    {
      title:"Hair Type",key:"hairType",
      opts:["Fine & Straight","Medium & Wavy","Coarse & Curly","Thick & Kinky","Thinning"],
      multi:false,icon:"💇"
    },
    {
      title:"Last Haircut",key:"lastCut",
      opts:["Within 1 week","1-2 weeks","2-4 weeks","1-2 months","3+ months"],
      multi:false,icon:"📅"
    },
    {
      title:"Any Scalp Concerns?",key:"scalp",
      opts:["None","Dandruff","Dryness","Sensitivity","Psoriasis","Oiliness"],
      multi:false,icon:"🔍"
    },
    {
      title:"Desired Style Goal",key:"goal",
      opts:["Clean & Professional","Bold & Edgy","Natural & Low-Maintenance","Match Reference Photo","Something New — Barber's Choice"],
      multi:false,icon:"🎯"
    },
    {
      title:"Allergies or Sensitivities",key:"allergies",
      opts:["None","Fragrance","Sulfates","Parabens","Lanolin","Latex"],
      multi:true,icon:"⚠️"
    },
  ];

  if(previewClient!==null){
    const client=forms.find(f=>f.id===previewClient);
    const step=FILL_STEPS[fillStep];
    const isDone=fillStep>=FILL_STEPS.length;

    if(isDone){
      return(
        <div className="modfull">
          <div className="sec screen" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"80vh"}}>
            <div className="consult-sent">
              <div style={{fontSize:56,marginBottom:16}}>✅</div>
              <h2 className="pf" style={{fontSize:22,fontWeight:700,marginBottom:8}}>Form Submitted!</h2>
              <p style={{fontSize:13,color:C.muted,marginBottom:6}}>Your barber will review your preferences before your appointment.</p>
              <p style={{fontSize:13,color:C.gold,fontWeight:600}}>See you at {client.appt} ✂️</p>
              <button className="btn bg" style={{marginTop:24,padding:"13px 32px"}} onClick={()=>{
                setForms(prev=>prev.map(f=>f.id===previewClient?{...f,status:"completed",submitted:"Just now",...fillData}:f));
                setPreviewClient(null);setFillStep(0);setFillData({hairType:"",lastCut:"",concerns:[],scalp:"",allergies:"",goal:"",notes:""});
                showToast("Form received from client!");
              }}>Done</button>
            </div>
          </div>
        </div>
      );
    }

    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>{setPreviewClient(null);setFillStep(0);}}>← Back</button>
            <p style={{fontSize:13,color:C.muted}}>Step {fillStep+1} of {FILL_STEPS.length}</p>
            <div style={{width:60}}/>
          </div>
          <div className="consult-progress">
            <div className="consult-progress-fill" style={{width:`${((fillStep)/FILL_STEPS.length)*100}%`}}/>
          </div>
          <div style={{textAlign:"center",marginBottom:8}}>
            <div style={{fontSize:36,marginBottom:8}}>{step.icon}</div>
            <h2 style={{fontSize:20,fontWeight:700}}>{step.title}</h2>
            <p style={{fontSize:12,color:C.muted,marginTop:4}}>For your {client.service} with {client.barber||"your barber"}</p>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:100}}>
          {step.opts.map(opt=>{
            const val=fillData[step.key];
            const isArr=Array.isArray(val);
            const sel=isArr?val.includes(opt):val===opt;
            return(
              <div key={opt} className={`consult-option${sel?" sel":""}`} onClick={()=>{
                if(step.multi){
                  const cur=Array.isArray(fillData[step.key])?fillData[step.key]:[];
                  setFillData(f=>({...f,[step.key]:sel?cur.filter(x=>x!==opt):[...cur,opt]}));
                } else {
                  setFillData(f=>({...f,[step.key]:opt}));
                }
              }}>
                <span style={{fontSize:14,fontWeight:500}}>{opt}</span>
              </div>
            );
          })}
          {fillStep===FILL_STEPS.length-1&&(
            <div style={{marginTop:12}}>
              <label className="lbl">Additional Notes for Barber</label>
              <textarea className="txa" placeholder="Anything else your barber should know…" value={fillData.notes} onChange={e=>setFillData(f=>({...f,notes:e.target.value}))} style={{minHeight:80}}/>
            </div>
          )}
          <button className="btn bg" style={{width:"100%",padding:"14px",marginTop:16,fontSize:15,fontWeight:700}}
            onClick={()=>{
              const val=fillData[step.key];
              if(!val||(Array.isArray(val)&&val.length===0&&step.key!=="allergies")){showToast("Please select an option");return;}
              setFillStep(s=>s+1);
            }}>
            {fillStep===FILL_STEPS.length-1?"Submit Form ✓":"Continue →"}
          </button>
          <button className="bo" style={{width:"100%",padding:"12px",marginTop:8,fontSize:13}} onClick={()=>setFillStep(s=>s+1)}>Skip</button>
        </div>
      </div>
    );
  }

  if(viewForm){
    const f=forms.find(x=>x.id===viewForm);
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setViewForm(null)}>← Back</button>
            <h2 style={{fontSize:18,fontWeight:700}}>Consultation — {f.client}</h2>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:80}}>
          <div style={{background:`${statusColor[f.status]}12`,border:`1px solid ${statusColor[f.status]}30`,borderRadius:14,padding:14,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <p style={{fontSize:13,fontWeight:700}}>{f.service} · {f.appt}</p>
              {f.submitted&&<p style={{fontSize:11,color:C.muted}}>Submitted {f.submitted}</p>}
            </div>
            <span style={{fontSize:13,fontWeight:700,color:statusColor[f.status]}}>{statusLabel[f.status]}</span>
          </div>
          {f.status==="completed"?(
            <div className="card">
              {[{l:"Hair Type",v:f.hairType},{l:"Last Cut",v:f.lastCut},{l:"Scalp",v:f.scalp||"None"},{l:"Style Goal",v:f.goal||"—"},{l:"Allergies",v:f.allergies||"None"},{l:"Notes",v:f.notes||"—"}].map(row=>(
                <div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:13,color:C.muted}}>{row.l}</span>
                  <span style={{fontSize:13,fontWeight:600,maxWidth:"60%",textAlign:"right"}}>{row.v||"—"}</span>
                </div>
              ))}
            </div>
          ):(
            <div style={{textAlign:"center",padding:32}}>
              <div style={{fontSize:48,marginBottom:12}}>⏳</div>
              <p style={{fontSize:15,fontWeight:700,marginBottom:6}}>Awaiting Client Response</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:20}}>Form {f.status==="sent"?"sent and waiting for client to complete":"not yet sent"}</p>
              <button className="btn bg" style={{padding:"12px 24px",marginBottom:10}} onClick={()=>{sendForm(f.id);setViewForm(null);}}>
                {f.status==="sent"?"🔄 Resend Form":"📤 Send Form Now"}
              </button>
              <br/>
              <button className="bo" style={{padding:"10px 24px",fontSize:13}} onClick={()=>{setPreviewClient(f.id);setFillStep(0);}}>
                👁 Preview Client Experience
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Consultation Forms</h2>
          <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={()=>showToast("New form template created!")}>+ Template</button>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          {[{id:"completed",icon:"✅",v:forms.filter(f=>f.status==="completed").length},{id:"pending",icon:"⏳",v:forms.filter(f=>f.status==="pending").length},{id:"sent",icon:"📤",v:forms.filter(f=>f.status==="sent").length}].map(s=>(
            <div key={s.id} style={{flex:1,background:C.card,border:`1px solid ${statusColor[s.id]}30`,borderRadius:12,padding:"10px",textAlign:"center"}}>
              <p style={{fontSize:20,fontWeight:800,color:statusColor[s.id]}}>{s.v}</p>
              <p style={{fontSize:10,color:C.muted,marginTop:2,textTransform:"capitalize"}}>{s.icon} {s.id}</p>
            </div>
          ))}
        </div>
        <div className="ptabs">
          {["today","all","templates"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>
      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {(tab==="today"||tab==="all")&&forms.map(f=>(
          <div key={f.id} className="card" style={{marginBottom:10,cursor:"pointer",borderColor:f.status==="completed"?`${C.green}30`:f.status==="pending"?`${C.orange}20`:C.border}} onClick={()=>setViewForm(f.id)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div>
                <p style={{fontSize:15,fontWeight:700}}>{f.client}</p>
                <p style={{fontSize:12,color:C.muted}}>{f.service} · {f.appt}</p>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:statusColor[f.status],background:`${statusColor[f.status]}15`,padding:"3px 10px",borderRadius:20}}>{statusLabel[f.status]}</span>
            </div>
            {f.status==="completed"&&(
              <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
                {[f.hairType,f.scalp||"No scalp issues",f.allergies||"No allergies"].filter(Boolean).map((tag,i)=>(
                  <span key={i} style={{fontSize:10,background:`${C.gold}12`,color:C.gold,padding:"2px 8px",borderRadius:20,fontWeight:600}}>{tag}</span>
                ))}
              </div>
            )}
            {f.status==="pending"&&(
              <button className="btn bg" style={{marginTop:8,padding:"8px 14px",fontSize:12,width:"100%"}} onClick={e=>{e.stopPropagation();sendForm(f.id);}}>📤 Send Form</button>
            )}
          </div>
        ))}
        {tab==="templates"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Form Templates</p>
            {[{name:"Standard Haircut",fields:5,icon:"✂️"},{name:"Beard Service",fields:4,icon:"🧔"},{name:"Color & Treatment",fields:7,icon:"🎨"},{name:"Kids Cut",fields:3,icon:"👦"}].map(t=>(
              <div key={t.name} className="card" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{fontSize:24}}>{t.icon}</span>
                  <div>
                    <p style={{fontSize:14,fontWeight:700}}>{t.name}</p>
                    <p style={{fontSize:11,color:C.muted}}>{t.fields} questions</p>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button className="bo" style={{fontSize:11,padding:"6px 12px"}} onClick={()=>showToast("Template edited!")}>Edit</button>
                  <button className="bgh" style={{fontSize:11,padding:"6px 12px"}} onClick={()=>showToast("Template duplicated!")}>Copy</button>
                </div>
              </div>
            ))}
            <button className="btn bg" style={{width:"100%",padding:"13px",marginTop:8}} onClick={()=>showToast("New template builder opened!")}>+ Create New Template</button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V13: CLIENT BIRTHDAY & ANNIVERSARY AUTOMATION
// ══════════════════════════════════════════
function BirthdayAutomationScreen({onClose}){
  const [clients]=useState(BDAY_CLIENTS);
  const [automation,setAutomation]=useState({enabled:true,timing:"dayOf",template:"deal",anniversaryEnabled:true,annivTiming:"weekBefore"});
  const [selTemplate,setSelTemplate]=useState("deal");
  const [customMsg,setCustomMsg]=useState("");
  const [tab,setTab]=useState("upcoming");
  const [sending,setSending]=useState(null);
  const [sent,setSent]=useState([]);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const sendMsg=(clientId)=>{
    setSending(clientId);
    setTimeout(()=>{setSending(null);setSent(s=>[...s,clientId]);showToast("🎂 Birthday message sent!");},1200);
  };

  const thisWeek=clients.filter(c=>c.daysUntil<=7);
  const upcoming=clients.filter(c=>c.daysUntil>7);
  const template=BDAY_TEMPLATES.find(t=>t.id===selTemplate);

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Birthday Automation</h2>
          <div style={{width:60}}/>
        </div>
        <div className="ptabs">
          {["upcoming","settings","history"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {tab==="upcoming"&&(
          <>
            {/* Stats banner */}
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              {[{l:"This Week",v:thisWeek.length,c:C.gold,icon:"🎂"},{l:"This Month",v:clients.length,c:C.blue,icon:"📅"},{l:"Sent",v:sent.length,c:C.green,icon:"✅"}].map(s=>(
                <div key={s.l} style={{flex:1,background:C.card,border:`1px solid ${s.c}25`,borderRadius:14,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontSize:18,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:10,color:C.muted}}>{s.l}</div>
                </div>
              ))}
            </div>

            {thisWeek.length>0&&(
              <>
                <p className="stit" style={{marginBottom:10}}>🎉 This Week</p>
                {thisWeek.map(c=>{
                  const isSent=sent.includes(c.id)||c.autoSent;
                  return(
                    <div key={c.id} className={`bday-card${c.daysUntil<=1?" bday-this-week":""}`}>
                      <div className="bday-avatar" style={{background:`linear-gradient(135deg,${c.color},${c.color}88)`}}>{c.avatar}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                          <p style={{fontSize:15,fontWeight:700}}>{c.name}</p>
                          {c.daysUntil===0&&<span style={{fontSize:10,background:`${C.gold}20`,color:C.gold,padding:"2px 8px",borderRadius:20,fontWeight:700}}>TODAY 🎂</span>}
                          {c.daysUntil===1&&<span style={{fontSize:10,background:`${C.orange}20`,color:C.orange,padding:"2px 8px",borderRadius:20,fontWeight:700}}>TOMORROW</span>}
                        </div>
                        <p style={{fontSize:12,color:C.muted}}>{c.bday} · {c.visits} visits</p>
                      </div>
                      {isSent
                        ?<span className="badge bgrn" style={{fontSize:10}}>✓ Sent</span>
                        :<button className="btn bg" style={{padding:"7px 14px",fontSize:12,flexShrink:0}}
                          onClick={()=>sendMsg(c.id)} disabled={sending===c.id}>
                          {sending===c.id?"...":`🎂 Send`}
                        </button>
                      }
                    </div>
                  );
                })}
              </>
            )}
            <p className="stit" style={{marginBottom:10,marginTop:8}}>📅 Upcoming</p>
            {upcoming.map(c=>(
              <div key={c.id} className="bday-card">
                <div className="bday-avatar" style={{background:`linear-gradient(135deg,${c.color},${c.color}88)`}}>{c.avatar}</div>
                <div style={{flex:1}}>
                  <p style={{fontSize:14,fontWeight:700}}>{c.name}</p>
                  <p style={{fontSize:12,color:C.muted}}>{c.bday} · {c.daysUntil} days away</p>
                </div>
                <span style={{fontSize:11,color:C.dim,fontStyle:"italic"}}>{automation.enabled?"Auto ✓":"Manual"}</span>
              </div>
            ))}
          </>
        )}

        {tab==="settings"&&(
          <>
            <div className="card" style={{marginBottom:12}}>
              <div className="automation-row" style={{paddingTop:0}}>
                <div>
                  <p style={{fontSize:15,fontWeight:700}}>Birthday Automation</p>
                  <p style={{fontSize:12,color:C.muted}}>Auto-send messages on client birthdays</p>
                </div>
                <Tog on={automation.enabled} toggle={()=>setAutomation(a=>({...a,enabled:!a.enabled}))}/>
              </div>
              {automation.enabled&&(
                <>
                  <div className="automation-row">
                    <p style={{fontSize:13,fontWeight:600}}>Send Timing</p>
                    <select value={automation.timing} onChange={e=>setAutomation(a=>({...a,timing:e.target.value}))} className="sel" style={{width:"auto"}}>
                      <option value="weekBefore">1 Week Before</option>
                      <option value="dayBefore">Day Before</option>
                      <option value="dayOf">Day Of</option>
                    </select>
                  </div>
                  <div style={{paddingTop:12}}>
                    <p style={{fontSize:13,fontWeight:600,marginBottom:10}}>Message Template</p>
                    {BDAY_TEMPLATES.map(t=>(
                      <div key={t.id} onClick={()=>{setSelTemplate(t.id);setAutomation(a=>({...a,template:t.id}));}} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px",borderRadius:12,border:`1px solid ${selTemplate===t.id?C.gold:C.border}`,background:selTemplate===t.id?`${C.gold}08`:C.surface,marginBottom:8,cursor:"pointer"}}>
                        <span style={{fontSize:20,flexShrink:0}}>{t.icon}</span>
                        <div style={{flex:1}}>
                          <p style={{fontSize:13,fontWeight:700,marginBottom:2}}>{t.label}</p>
                          {t.id!=="custom"&&<p style={{fontSize:11,color:C.muted,lineHeight:1.4}}>{t.msg.slice(0,80)}…</p>}
                          {t.id==="custom"&&<textarea className="txa" style={{marginTop:6,minHeight:70,fontSize:12}} placeholder="Write your custom birthday message…" value={customMsg} onChange={e=>setCustomMsg(e.target.value)} onClick={e=>e.stopPropagation()}/>}
                        </div>
                        {selTemplate===t.id&&<span style={{color:C.gold,fontSize:16,flexShrink:0}}>✓</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card" style={{marginBottom:12}}>
              <div className="automation-row" style={{paddingTop:0}}>
                <div>
                  <p style={{fontSize:15,fontWeight:700}}>Anniversary Automation</p>
                  <p style={{fontSize:12,color:C.muted}}>Celebrate client loyalty milestones</p>
                </div>
                <Tog on={automation.anniversaryEnabled} toggle={()=>setAutomation(a=>({...a,anniversaryEnabled:!a.anniversaryEnabled}))}/>
              </div>
              {automation.anniversaryEnabled&&(
                <div className="automation-row">
                  <p style={{fontSize:13,fontWeight:600}}>Trigger</p>
                  <select value={automation.annivTiming} onChange={e=>setAutomation(a=>({...a,annivTiming:e.target.value}))} className="sel" style={{width:"auto"}}>
                    <option value="weekBefore">1 Week Before Anniversary</option>
                    <option value="dayOf">On Anniversary Date</option>
                    <option value="milestone">Milestone Visits (10,25,50)</option>
                  </select>
                </div>
              )}
            </div>

            <button className="btn bg" style={{width:"100%",padding:"14px"}} onClick={()=>showToast("✅ Automation settings saved!")}>Save Settings</button>
          </>
        )}

        {tab==="history"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Sent This Month</p>
            {[
              {client:"DJ Kool",type:"Birthday",date:"Feb 14",msg:"Birthday Deal",opened:true},
              {client:"Kendra D.",type:"Anniversary",date:"Feb 10",msg:"2-Year Client Anniversary",opened:true},
              {client:"Alex C.",type:"Birthday",date:"Feb 8",msg:"Free Service Offer",opened:false},
              {client:"Jerome W.",type:"Birthday",date:"Feb 3",msg:"Simple Wish",opened:true},
            ].map((h,i)=>(
              <div key={i} className="card" style={{marginBottom:8,display:"flex",gap:12,alignItems:"center"}}>
                <span style={{fontSize:24}}>{h.type==="Birthday"?"🎂":"🎉"}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <p style={{fontSize:14,fontWeight:700}}>{h.client}</p>
                    <p style={{fontSize:11,color:C.muted}}>{h.date}</p>
                  </div>
                  <p style={{fontSize:12,color:C.muted}}>{h.type} · {h.msg}</p>
                </div>
                <span style={{fontSize:11,fontWeight:700,color:h.opened?C.green:C.dim}}>{h.opened?"Opened":"Not opened"}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V13: BEFORE/AFTER REQUEST FLOW
// ══════════════════════════════════════════
function BeforeAfterRequestScreen({onClose}){
  const [requests,setRequests]=useState(BA_REQUESTS_INIT);
  const [tab,setTab]=useState("requests");
  const [newReq,setNewReq]=useState(false);
  const [reqStep,setReqStep]=useState(0);
  const [selCategory,setSelCategory]=useState(null);
  const [selStyle,setSelStyle]=useState(null);
  const [inspoSlots,setInspoSlots]=useState([null,null,null]);
  const [currentSlot,setCurrentSlot]=useState(null);
  const [clientNotes,setClientNotes]=useState("");
  const [selReq,setSelReq]=useState(null);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const fakeUpload=(slotIdx,type)=>{
    if(type==="inspo"){
      const newSlots=[...inspoSlots];
      newSlots[slotIdx]=`photo_${slotIdx+1}`;
      setInspoSlots(newSlots);
      showToast("📸 Photo added!");
    } else {
      setCurrentSlot(`current_photo`);
      showToast("📸 Current photo added!");
    }
  };

  const submitRequest=()=>{
    const newR={
      id:requests.length+1,
      client:"You",
      appt:"Next Appointment",
      service:selStyle?`${selStyle}`:"Custom Style",
      inspoUploaded:inspoSlots.some(s=>s),
      currentUploaded:!!currentSlot,
      notes:clientNotes,
      status:"received",
      barber:"DJ Kool",
    };
    setRequests(prev=>[newR,...prev]);
    setNewReq(false);setReqStep(0);setSelCategory(null);setSelStyle(null);
    setInspoSlots([null,null,null]);setCurrentSlot(null);setClientNotes("");
    showToast("✅ Request sent to your barber!");
  };

  // New Request Flow
  if(newReq){
    const REQ_STEPS=["Choose Style","Inspiration Photos","Current Hair","Notes & Submit"];
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>{if(reqStep===0)setNewReq(false);else setReqStep(s=>s-1);}}>← Back</button>
            <p style={{fontSize:13,fontWeight:600}}>{REQ_STEPS[reqStep]}</p>
            <p style={{fontSize:12,color:C.muted}}>{reqStep+1}/{REQ_STEPS.length}</p>
          </div>
          <div className="consult-progress">
            <div className="consult-progress-fill" style={{width:`${((reqStep+1)/REQ_STEPS.length)*100}%`}}/>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:100}}>
          {reqStep===0&&(
            <>
              <p className="stit" style={{marginBottom:12}}>What style are you going for?</p>
              {STYLE_CATEGORIES.map(cat=>(
                <div key={cat.id} style={{marginBottom:16}}>
                  <p style={{fontSize:13,color:C.muted,fontWeight:600,marginBottom:8}}>{cat.icon} {cat.label}</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {cat.styles.map(style=>(
                      <div key={style} className={`hair-chip${selStyle===style?" sel":""}`}
                        onClick={()=>{setSelStyle(style);setSelCategory(cat.id);}}>
                        {style}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button className="btn bg" style={{width:"100%",padding:"14px",marginTop:8}} onClick={()=>{if(!selStyle){showToast("Select a style first");return;}setReqStep(1);}}>Continue →</button>
              <button className="bo" style={{width:"100%",padding:"12px",marginTop:8}} onClick={()=>{setSelStyle("Barber's Choice");setReqStep(1);}}>✨ Leave it to the barber</button>
            </>
          )}
          {reqStep===1&&(
            <>
              <p className="stit" style={{marginBottom:4}}>Add inspiration photos</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Upload up to 3 reference images that show the style you want</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:20}}>
                {inspoSlots.map((slot,i)=>(
                  <div key={i} className={`ref-photo-slot${slot?" filled":""}`} style={{width:"calc(50% - 6px)"}}
                    onClick={()=>fakeUpload(i,"inspo")}>
                    {slot?(
                      <>
                        <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${C.gold}20,${C.purple}20)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <span style={{fontSize:36}}>📸</span>
                        </div>
                        <div style={{position:"absolute",top:8,right:8,width:22,height:22,borderRadius:"50%",background:C.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>✓</div>
                      </>
                    ):(
                      <>
                        <span style={{fontSize:28,marginBottom:6,color:C.dim}}>+</span>
                        <span style={{fontSize:11,color:C.dim}}>Add Photo</span>
                      </>
                    )}
                  </div>
                ))}
                <div style={{width:"calc(50% - 6px)",display:"flex",flexDirection:"column",gap:8}}>
                  <p style={{fontSize:11,color:C.muted,lineHeight:1.5}}>💡 Tip: Include photos from the front and side for best results.</p>
                </div>
              </div>
              <button className="btn bg" style={{width:"100%",padding:"14px"}} onClick={()=>setReqStep(2)}>
                {inspoSlots.some(s=>s)?"Continue →":"Skip — No reference photo"}
              </button>
            </>
          )}
          {reqStep===2&&(
            <>
              <p className="stit" style={{marginBottom:4}}>Photo of your current hair</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Helps your barber understand your starting point</p>
              <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
                <div className={`ref-photo-slot${currentSlot?" filled":""}`} style={{width:200,height:200}}
                  onClick={()=>fakeUpload(0,"current")}>
                  {currentSlot?(
                    <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${C.blue}20,${C.green}20)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{fontSize:48}}>🤳</span>
                    </div>
                  ):(
                    <>
                      <span style={{fontSize:40,marginBottom:8,color:C.dim}}>🤳</span>
                      <span style={{fontSize:13,color:C.dim,fontWeight:600}}>Tap to add photo</span>
                    </>
                  )}
                </div>
              </div>
              <button className="btn bg" style={{width:"100%",padding:"14px"}} onClick={()=>setReqStep(3)}>
                {currentSlot?"Continue →":"Skip — No current photo"}
              </button>
            </>
          )}
          {reqStep===3&&(
            <>
              <p className="stit" style={{marginBottom:4}}>Final notes for your barber</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:12}}>Any specific instructions, concerns, or preferences?</p>
              <textarea className="txa" style={{minHeight:120,marginBottom:16}} placeholder="e.g. 'Keep it longer on top, tight on sides. Going to a wedding next weekend…'" value={clientNotes} onChange={e=>setClientNotes(e.target.value)}/>

              {/* Request summary */}
              <div className="card" style={{marginBottom:16}}>
                <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>📋 Request Summary</p>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,color:C.muted}}>Style</span>
                  <span style={{fontSize:12,fontWeight:600}}>{selStyle||"Barber's Choice"}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,color:C.muted}}>Inspiration Photos</span>
                  <span style={{fontSize:12,fontWeight:600,color:inspoSlots.some(s=>s)?C.green:C.muted}}>{inspoSlots.filter(s=>s).length} attached</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}>
                  <span style={{fontSize:12,color:C.muted}}>Current Hair Photo</span>
                  <span style={{fontSize:12,fontWeight:600,color:currentSlot?C.green:C.muted}}>{currentSlot?"Attached":"Not attached"}</span>
                </div>
              </div>
              <button className="btn bg" style={{width:"100%",padding:"15px",fontSize:15,fontWeight:700}} onClick={submitRequest}>
                📤 Send to Barber
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if(selReq){
    const req=requests.find(r=>r.id===selReq);
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setSelReq(null)}>← Back</button>
            <h2 style={{fontSize:18,fontWeight:700}}>Request — {req.client}</h2>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:80}}>
          <div style={{background:req.status==="received"?`${C.green}10`:`${C.blue}10`,border:`1px solid ${req.status==="received"?C.green:C.blue}30`,borderRadius:14,padding:14,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div>
                <p style={{fontSize:13,fontWeight:700}}>{req.service}</p>
                <p style={{fontSize:11,color:C.muted}}>{req.appt} · {req.barber}</p>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:req.status==="received"?C.green:C.blue}}>
                {req.status==="received"?"✅ Received":"⏳ Pending"}
              </span>
            </div>
          </div>
          <div className="card" style={{marginBottom:12}}>
            <p className="stit" style={{marginBottom:10}}>Attached Media</p>
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{flex:1,background:req.inspoUploaded?`${C.gold}10`:C.surface,border:`1px solid ${req.inspoUploaded?C.gold:C.border}`,borderRadius:12,padding:14,textAlign:"center"}}>
                <div style={{fontSize:24,marginBottom:4}}>📸</div>
                <p style={{fontSize:12,fontWeight:600,color:req.inspoUploaded?C.gold:C.muted}}>Inspo Photo</p>
                <p style={{fontSize:10,color:req.inspoUploaded?C.green:C.red}}>{req.inspoUploaded?"✓ Attached":"Not attached"}</p>
              </div>
              <div style={{flex:1,background:req.currentUploaded?`${C.blue}10`:C.surface,border:`1px solid ${req.currentUploaded?C.blue:C.border}`,borderRadius:12,padding:14,textAlign:"center"}}>
                <div style={{fontSize:24,marginBottom:4}}>🤳</div>
                <p style={{fontSize:12,fontWeight:600,color:req.currentUploaded?C.blue:C.muted}}>Current Hair</p>
                <p style={{fontSize:10,color:req.currentUploaded?C.green:C.red}}>{req.currentUploaded?"✓ Attached":"Not attached"}</p>
              </div>
            </div>
          </div>
          <div className="card" style={{marginBottom:16}}>
            <p style={{fontSize:13,fontWeight:700,marginBottom:6}}>Client Notes</p>
            <p style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{req.notes||"No notes provided."}</p>
          </div>
          <button className="btn bg" style={{width:"100%",padding:"13px",marginBottom:10}} onClick={()=>showToast("Reply sent to client!")}>💬 Reply to Client</button>
          <button className="bo" style={{width:"100%",padding:"12px"}} onClick={()=>showToast("Request marked complete!")}>✅ Mark as Reviewed</button>
        </div>
      </div>
    );
  }

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Style Requests</h2>
          <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={()=>setNewReq(true)}>+ New</button>
        </div>
        <div className="ptabs">
          {["requests","gallery"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>
      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {tab==="requests"&&(
          <>
            <div style={{background:`${C.blue}10`,border:`1px solid ${C.blue}25`,borderRadius:14,padding:14,marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:20}}>💡</span>
              <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Clients can send style references and photos before their appointment so you can prepare.</p>
            </div>
            {requests.map(req=>(
              <div key={req.id} className="card" style={{marginBottom:10,cursor:"pointer",borderColor:req.status==="received"?`${C.green}30`:C.border}} onClick={()=>setSelReq(req.id)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <p style={{fontSize:15,fontWeight:700}}>{req.client}</p>
                    <p style={{fontSize:12,color:C.muted}}>{req.service} · {req.appt}</p>
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:req.status==="received"?C.green:C.blue,background:`${req.status==="received"?C.green:C.blue}15`,padding:"3px 10px",borderRadius:20}}>{req.status==="received"?"Received":"Pending"}</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <span style={{fontSize:11,background:`${C.gold}12`,color:C.gold,padding:"3px 10px",borderRadius:20,fontWeight:600}}>{req.inspoUploaded?"📸 Inspo":"No inspo"}</span>
                  <span style={{fontSize:11,background:`${C.blue}12`,color:C.blue,padding:"3px 10px",borderRadius:20,fontWeight:600}}>{req.currentUploaded?"🤳 Current":"No current"}</span>
                  {req.notes&&<span style={{fontSize:11,background:`${C.purple}12`,color:C.purple,padding:"3px 10px",borderRadius:20,fontWeight:600}}>📝 Notes</span>}
                </div>
              </div>
            ))}
            <button className="bo" style={{width:"100%",padding:"13px",marginTop:8}} onClick={()=>setNewReq(true)}>+ Submit New Style Request</button>
          </>
        )}
        {tab==="gallery"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Before & After Gallery</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[{name:"Marcus J.",style:"Skin Fade",date:"Feb 22"},{name:"Tyrese B.",style:"Texture Top",date:"Feb 20"},{name:"Aisha W.",style:"Silk Press",date:"Feb 18"},{name:"Devon K.",style:"Mid Fade",date:"Feb 15"},{name:"Kendra D.",style:"Box Braids",date:"Feb 12"},{name:"Alex C.",style:"Caesar",date:"Feb 10"}].map((item,i)=>(
                <div key={i} style={{background:C.card,borderRadius:16,overflow:"hidden",border:`1px solid ${C.border}`}}>
                  <div style={{height:80,background:`linear-gradient(135deg,${[C.gold,C.blue,C.purple,C.green,C.pink,C.orange][i%6]}20,${[C.purple,C.green,C.gold,C.blue,C.orange,C.pink][i%6]}15)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>✂️</div>
                  <div style={{padding:"8px 10px"}}>
                    <p style={{fontSize:12,fontWeight:700}}>{item.name}</p>
                    <p style={{fontSize:10,color:C.muted}}>{item.style} · {item.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V13: CHAIR RENTAL MANAGEMENT
// ══════════════════════════════════════════
function ChairRentalScreen({onClose}){
  const [renters,setRenters]=useState(CHAIR_RENTERS_INIT);
  const [payments,setPayments]=useState(CHAIR_PAYMENTS_INIT);
  const [selChair,setSelChair]=useState(null);
  const [addRenter,setAddRenter]=useState(false);
  const [tab,setTab]=useState("chairs");
  const [form,setForm]=useState({name:"",phone:"",email:"",chair:"Chair 4",weeklyRent:"200",specialties:""});
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const setF=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  const totalMonthly=renters.filter(r=>r.status!=="vacant").reduce((s,r)=>s+r.monthlyRent,0);
  const overdue=renters.filter(r=>r.status==="overdue");
  const totalOverdue=overdue.reduce((s,r)=>s+Math.abs(r.balance),0);

  const recordPayment=(renterId)=>{
    setRenters(prev=>prev.map(r=>r.id===renterId?{...r,balance:0,status:"active"}:r));
    setPayments(prev=>[{id:Date.now(),renter:renters.find(r=>r.id===renterId)?.name,amount:renters.find(r=>r.id===renterId)?.monthlyRent,date:"Today",method:"Cash",status:"paid"},...prev]);
    showToast("✅ Payment recorded!");
    setSelChair(null);
  };

  const submitRenter=()=>{
    if(!form.name||!form.phone){showToast("Name and phone required");return;}
    const weekly=parseInt(form.weeklyRent)||200;
    setRenters(prev=>prev.map(r=>r.chair===form.chair?{...r,
      name:form.name,avatar:form.name[0].toUpperCase(),color:[C.gold,C.blue,C.purple,C.pink][Math.floor(Math.random()*4)],
      phone:form.phone,email:form.email,weeklyRent:weekly,monthlyRent:weekly*4,
      status:"active",since:"Mar 2026",paidMonths:0,
      specialties:form.specialties?form.specialties.split(",").map(s=>s.trim()):[],
    }:r));
    setAddRenter(false);
    setForm({name:"",phone:"",email:"",chair:"Chair 4",weeklyRent:"200",specialties:""});
    showToast(`✅ ${form.name} added to ${form.chair}!`);
  };

  if(addRenter){
    const vacantChairs=renters.filter(r=>r.status==="vacant").map(r=>r.chair);
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setAddRenter(false)}>← Back</button>
            <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Add Renter</h2>
            <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={submitRenter}>Save</button>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:100}}>
          <div className="card" style={{marginBottom:12}}>
            <p className="stit" style={{marginBottom:12}}>Renter Info</p>
            <div style={{marginBottom:12}}><label className="lbl">Full Name *</label><input value={form.name} onChange={setF("name")} className="inp" placeholder="Barber's full name"/></div>
            <div style={{marginBottom:12}}><label className="lbl">Phone *</label><input value={form.phone} onChange={setF("phone")} className="inp" placeholder="(504) 555-0000" type="tel"/></div>
            <div style={{marginBottom:12}}><label className="lbl">Email</label><input value={form.email} onChange={setF("email")} className="inp" placeholder="barber@email.com" type="email"/></div>
            <div style={{marginBottom:12}}>
              <label className="lbl">Assign Chair</label>
              <select value={form.chair} onChange={setF("chair")} className="sel">
                {vacantChairs.length>0?vacantChairs.map(c=><option key={c}>{c}</option>):<option>No vacant chairs</option>}
              </select>
            </div>
            <div><label className="lbl">Specialties (comma-separated)</label><input value={form.specialties} onChange={setF("specialties")} className="inp" placeholder="Fades, Dreads, Kids Cuts"/></div>
          </div>
          <div className="card" style={{marginBottom:20}}>
            <p className="stit" style={{marginBottom:12}}>Rent Terms</p>
            <div style={{marginBottom:12}}>
              <label className="lbl">Weekly Rent ($)</label>
              <div style={{display:"flex",gap:8}}>
                {["150","175","200","225","250"].map(v=>(
                  <div key={v} onClick={()=>setForm(f=>({...f,weeklyRent:v}))} style={{flex:1,padding:"10px 4px",borderRadius:10,border:`1px solid ${form.weeklyRent===v?C.gold:C.border}`,background:form.weeklyRent===v?`${C.gold}12`:C.surface,color:form.weeklyRent===v?C.gold:C.muted,textAlign:"center",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .18s"}}>
                    ${v}
                  </div>
                ))}
              </div>
            </div>
            <div style={{background:C.surface,borderRadius:12,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:13,color:C.muted}}>Weekly Rent</span><span style={{fontSize:13,fontWeight:700}}>${form.weeklyRent}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,color:C.muted}}>Monthly (×4)</span><span style={{fontSize:13,fontWeight:700,color:C.gold}}>${parseInt(form.weeklyRent||0)*4}</span>
              </div>
            </div>
          </div>
          <button className="btn bg" style={{width:"100%",padding:"15px",fontSize:15,fontWeight:700}} onClick={submitRenter}>🪑 Add Renter</button>
        </div>
      </div>
    );
  }

  if(selChair){
    const r=renters.find(x=>x.id===selChair);
    if(r.status==="vacant"){
      return(
        <div className="modfull">
          <Toast msg={toast}/>
          <div className="hdr">
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setSelChair(null)}>← Back</button>
              <h2 style={{fontSize:18,fontWeight:700}}>{r.chair} — Vacant</h2>
            </div>
          </div>
          <div className="sec screen" style={{paddingBottom:80,textAlign:"center",paddingTop:40}}>
            <div style={{fontSize:64,marginBottom:16}}>🪑</div>
            <p style={{fontSize:16,fontWeight:700,marginBottom:6}}>{r.chair} is Available</p>
            <p style={{fontSize:13,color:C.muted,marginBottom:24}}>Add a booth renter to fill this chair and start generating rental income.</p>
            <button className="btn bg" style={{padding:"14px 32px"}} onClick={()=>{setSelChair(null);setAddRenter(true);}}>+ Add Renter</button>
          </div>
        </div>
      );
    }
    const rPayments=payments.filter(p=>p.renter===r.name);
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setSelChair(null)}>← Back</button>
            <div style={{flex:1}}>
              <h2 style={{fontSize:18,fontWeight:700}}>{r.name}</h2>
              <p style={{fontSize:12,color:C.muted}}>{r.chair} · Since {r.since}</p>
            </div>
            <span className={`chair-status-badge ${r.status}`}>{r.status}</span>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:80}}>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[{l:"Weekly",v:`$${r.weeklyRent}`,c:C.gold},{l:"Monthly",v:`$${r.monthlyRent}`,c:C.green},{l:"Months Paid",v:r.paidMonths,c:C.blue},{l:"Balance",v:r.balance<0?`-$${Math.abs(r.balance)}`:"$0",c:r.balance<0?C.red:C.green}].map(s=>(
              <div key={s.l} style={{flex:1,background:C.card,border:`1px solid ${s.c}25`,borderRadius:12,padding:"10px 4px",textAlign:"center"}}>
                <p style={{fontSize:15,fontWeight:800,color:s.c}}>{s.v}</p>
                <p style={{fontSize:9,color:C.muted,marginTop:2}}>{s.l}</p>
              </div>
            ))}
          </div>
          {r.status==="overdue"&&(
            <div style={{background:`${C.red}12`,border:`1px solid ${C.red}30`,borderRadius:14,padding:14,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:C.red}}>Payment Overdue</p>
                  <p style={{fontSize:12,color:C.muted}}>Due {r.nextDue} · ${Math.abs(r.balance)} owed</p>
                </div>
                <span style={{fontSize:20}}>⚠️</span>
              </div>
              <button style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:C.green,color:"white",fontWeight:700,cursor:"pointer"}} onClick={()=>recordPayment(r.id)}>
                ✅ Record Payment — ${r.monthlyRent}
              </button>
            </div>
          )}
          <div className="card" style={{marginBottom:12}}>
            <p className="stit" style={{marginBottom:10}}>Renter Details</p>
            {[{l:"Phone",v:r.phone},{l:"Email",v:r.email||"—"},{l:"Next Due",v:r.nextDue},{l:"Specialties",v:r.specialties.join(", ")||"—"}].map(row=>(
              <div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{row.l}</span>
                <span style={{fontSize:13,fontWeight:600,maxWidth:"60%",textAlign:"right"}}>{row.v}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:12}}>
            <p className="stit" style={{marginBottom:10}}>Payment History</p>
            {rPayments.length>0?rPayments.map((p,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <div><p style={{fontSize:13,fontWeight:600}}>{p.date}</p><p style={{fontSize:11,color:C.muted}}>{p.method}</p></div>
                <div style={{textAlign:"right"}}><p style={{fontSize:13,fontWeight:700,color:C.green}}>${p.amount}</p><span className="badge bgrn" style={{fontSize:9}}>Paid</span></div>
              </div>
            )):<p style={{fontSize:12,color:C.dim,padding:"8px 0"}}>No payment history</p>}
          </div>
          {r.status==="active"&&<button className="btn bg" style={{width:"100%",padding:"13px",marginBottom:10}} onClick={()=>{recordPayment(r.id);}}>💵 Record Payment — ${r.monthlyRent}</button>}
          <button className="bo" style={{width:"100%",padding:"12px"}} onClick={()=>showToast("Message sent!")}>💬 Send Reminder</button>
        </div>
      </div>
    );
  }

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Chair Rentals</h2>
          <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={()=>setAddRenter(true)}>+ Add</button>
        </div>
        <div style={{background:`linear-gradient(135deg,rgba(201,168,76,.12),rgba(76,175,122,.08))`,border:`1px solid ${C.gold}25`,borderRadius:16,padding:16,marginBottom:12}}>
          <div style={{display:"flex",gap:16}}>
            <div><p style={{fontSize:22,fontWeight:800,color:C.gold}}>${totalMonthly}</p><p style={{fontSize:10,color:C.muted}}>Monthly Income</p></div>
            <div><p style={{fontSize:22,fontWeight:800,color:renters.filter(r=>r.status!=="vacant").length>0?C.blue:C.dim}}>{renters.filter(r=>r.status!=="vacant").length}/{renters.length}</p><p style={{fontSize:10,color:C.muted}}>Chairs Rented</p></div>
            {overdue.length>0&&<div><p style={{fontSize:22,fontWeight:800,color:C.red}}>${totalOverdue}</p><p style={{fontSize:10,color:C.muted}}>Overdue</p></div>}
          </div>
        </div>
        <div className="ptabs">
          {["chairs","payments"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>
      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {tab==="chairs"&&renters.map(r=>(
          <div key={r.id} className="chair-card" onClick={()=>setSelChair(r.id)}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:r.status!=="vacant"?10:0}}>
              <div style={{width:46,height:46,borderRadius:14,background:r.status==="vacant"?`${C.dim}15`:`${r.color}20`,border:`1px solid ${r.status==="vacant"?C.border:`${r.color}40`}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:r.status==="vacant"?22:18,fontWeight:700,color:r.status==="vacant"?C.dim:r.color,flexShrink:0}}>
                {r.status==="vacant"?"🪑":r.avatar}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                  <p style={{fontSize:15,fontWeight:700}}>{r.status==="vacant"?r.chair:r.name}</p>
                  <span className={`chair-status-badge ${r.status}`}>{r.status==="vacant"?"Available":r.status}</span>
                </div>
                <p style={{fontSize:12,color:C.muted}}>{r.status==="vacant"?`${r.chair} · Available for rent`:`${r.chair} · $${r.monthlyRent}/mo`}</p>
              </div>
              <span style={{color:C.dim,fontSize:18}}>›</span>
            </div>
            {r.status!=="vacant"&&(
              <>
                <div style={{display:"flex",gap:8}}>
                  {r.specialties.slice(0,3).map(s=>(
                    <span key={s} style={{fontSize:10,background:`${r.color}12`,color:r.color,padding:"2px 8px",borderRadius:20,fontWeight:600}}>{s}</span>
                  ))}
                </div>
                {r.status==="overdue"&&(
                  <div style={{marginTop:10,padding:"8px 12px",background:`${C.red}12`,border:`1px solid ${C.red}30`,borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:12,color:C.red,fontWeight:600}}>⚠️ Payment overdue</span>
                    <span style={{fontSize:12,fontWeight:700,color:C.red}}>-${Math.abs(r.balance)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {tab==="payments"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Recent Transactions</p>
            {payments.map((p,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{width:36,height:36,borderRadius:10,background:p.status==="paid"?`${C.green}15`:`${C.red}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
                    {p.status==="paid"?"💵":"⚠️"}
                  </div>
                  <div>
                    <p style={{fontSize:13,fontWeight:700}}>{p.renter}</p>
                    <p style={{fontSize:11,color:C.muted}}>{p.date} · {p.method}</p>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontSize:14,fontWeight:800,color:p.status==="paid"?C.green:C.red}}>${p.amount}</p>
                  <span style={{fontSize:10,fontWeight:700,color:p.status==="paid"?C.green:C.red}}>{p.status}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V13: WAITING ROOM DISPLAY (TV QUEUE BOARD)
// ══════════════════════════════════════════
function WaitingRoomScreen({onClose}){
  const [displayMode,setDisplayMode]=useState("preview"); // preview | live | settings
  const [showPromo,setShowPromo]=useState(true);
  const [showTime,setShowTime]=useState(true);
  const [showWifi,setShowWifi]=useState(true);
  const [wifiName,setWifiName]=useState("ChopItUp_Guest");
  const [wifiPass,setWifiPass]=useState("haircuts2024");
  const [promoText,setPromoText]=useState("💈 Book your next cut — chopitup.app/book");
  const [colorTheme,setColorTheme]=useState("dark");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const queue=[
    {num:1,name:"Marcus J.",service:"Skin Fade",barber:"DJ Kool",wait:"Now",status:"serving"},
    {num:2,name:"Tyrese B.",service:"Haircut",barber:"Ray B.",wait:"~5 min",status:"next"},
    {num:3,name:"Aisha W.",service:"Silk Press",barber:"Marcus",wait:"~20 min",status:"waiting"},
    {num:4,name:"Devon K.",service:"Beard Trim",barber:"DJ Kool",wait:"~30 min",status:"waiting"},
    {num:5,name:"Kendra D.",service:"Haircut",barber:"Ray B.",wait:"~40 min",status:"waiting"},
  ];

  const TVDisplay=()=>(
    <div className="tv-screen" style={{background:colorTheme==="dark"?"#0a0a0c":colorTheme==="gold"?"#0f0d00":"#f0f0f0"}}>
      {/* Header */}
      <div style={{padding:"16px 20px",background:colorTheme==="gold"?"rgba(201,168,76,.2)":"rgba(255,255,255,.04)",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:22}}>✂️</span>
          <div>
            <p style={{fontSize:16,fontWeight:700,color:C.gold,fontFamily:"'Playfair Display',serif"}}>Chop-It-Up</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>Queue Status</p>
          </div>
        </div>
        {showTime&&<div style={{textAlign:"right"}}>
          <p style={{fontSize:18,fontWeight:700,color:colorTheme==="gold"?C.gold:"white",fontFamily:"'Playfair Display',serif"}}>9:41 AM</p>
          <p style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>Tue, Feb 24</p>
        </div>}
      </div>

      {/* Queue */}
      <div style={{padding:"4px 0"}}>
        {queue.map((item,i)=>(
          <div key={i} className={`tv-queue-row${item.status==="serving"?" serving":item.status==="next"?" next":""}`}>
            <div className="tv-number" style={{background:item.status==="serving"?C.green:item.status==="next"?C.gold:"rgba(255,255,255,.1)",color:item.status==="serving"||item.status==="next"?"#000":"rgba(255,255,255,.6)"}}>
              {item.status==="serving"?"✂️":item.num}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                <p style={{fontSize:13,fontWeight:700,color:item.status==="serving"?C.green:item.status==="next"?C.gold:"rgba(255,255,255,.85)"}}>{item.name}</p>
                {item.status==="serving"&&<span style={{fontSize:9,background:`${C.green}30`,color:C.green,padding:"1px 6px",borderRadius:20,fontWeight:700}}>IN CHAIR</span>}
                {item.status==="next"&&<span style={{fontSize:9,background:`${C.gold}30`,color:C.gold,padding:"1px 6px",borderRadius:20,fontWeight:700}}>YOU'RE NEXT</span>}
              </div>
              <p style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{item.service} · {item.barber}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:11,fontWeight:700,color:item.status==="serving"?C.green:item.status==="next"?C.gold:"rgba(255,255,255,.5)"}}>{item.wait}</p>
            </div>
          </div>
        ))}
      </div>

      {/* WiFi info */}
      {showWifi&&(
        <div style={{padding:"10px 20px",background:"rgba(255,255,255,.03)",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",gap:16,alignItems:"center"}}>
          <span style={{fontSize:16}}>📶</span>
          <div>
            <p style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>FREE WiFi</p>
            <p style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)"}}>{wifiName}</p>
          </div>
          <div style={{marginLeft:8}}>
            <p style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>Password</p>
            <p style={{fontSize:12,fontWeight:700,color:C.gold}}>{wifiPass}</p>
          </div>
        </div>
      )}

      {/* Promo ticker */}
      {showPromo&&(
        <div className="tv-ticker">
          <span className="tv-ticker-inner" style={{fontSize:11,color:C.gold,fontWeight:600}}>{promoText} &nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;&nbsp; {promoText} &nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;&nbsp; {promoText}</span>
        </div>
      )}
    </div>
  );

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Waiting Room Display</h2>
          <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={()=>showToast("🖥 Display URL copied — open on your TV!")}>🖥 Launch</button>
        </div>
        <div className="ptabs">
          {["preview","settings"].map(t=>(
            <div key={t} className={`ptab${displayMode===t?" act":""}`} onClick={()=>setDisplayMode(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {displayMode==="preview"&&(
          <>
            <div style={{background:`${C.blue}10`,border:`1px solid ${C.blue}25`,borderRadius:14,padding:14,marginBottom:16,display:"flex",gap:10}}>
              <span style={{fontSize:20}}>💡</span>
              <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>This display is designed for a TV or monitor in your waiting area. Clients can see their queue position and estimated wait time.</p>
            </div>
            <TVDisplay/>
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button className="btn bg" style={{flex:1,padding:"13px"}} onClick={()=>showToast("Display URL copied to clipboard!")}>📋 Copy Display URL</button>
              <button className="bo" style={{flex:1,padding:"13px"}} onClick={()=>showToast("QR code for TV display downloaded!")}>📱 QR Code</button>
            </div>
          </>
        )}

        {displayMode==="settings"&&(
          <>
            <div className="card" style={{marginBottom:12}}>
              <p className="stit" style={{marginBottom:12}}>Color Theme</p>
              <div style={{display:"flex",gap:8}}>
                {[{id:"dark",l:"Dark",bg:"#0a0a0c"},{id:"gold",l:"Gold",bg:"#1a1100"},{id:"light",l:"Light",bg:"#f0f0f0"}].map(t=>(
                  <div key={t.id} onClick={()=>setColorTheme(t.id)} style={{flex:1,padding:12,borderRadius:12,border:`2px solid ${colorTheme===t.id?C.gold:C.border}`,background:t.bg,cursor:"pointer",textAlign:"center"}}>
                    <p style={{fontSize:12,fontWeight:700,color:colorTheme===t.id?C.gold:C.muted}}>{t.l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{marginBottom:12}}>
              <p className="stit" style={{marginBottom:12}}>Display Options</p>
              {[{l:"Show Clock",v:"showTime",on:showTime,set:setShowTime},{l:"Show WiFi Info",v:"showWifi",on:showWifi,set:setShowWifi},{l:"Show Promo Banner",v:"showPromo",on:showPromo,set:setShowPromo}].map(opt=>(
                <div key={opt.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:14,fontWeight:500}}>{opt.l}</span>
                  <Tog on={opt.on} toggle={()=>opt.set(!opt.on)}/>
                </div>
              ))}
            </div>
            {showWifi&&(
              <div className="card" style={{marginBottom:12}}>
                <p className="stit" style={{marginBottom:12}}>WiFi Credentials</p>
                <div style={{marginBottom:10}}><label className="lbl">Network Name</label><input className="inp" value={wifiName} onChange={e=>setWifiName(e.target.value)}/></div>
                <div><label className="lbl">Password</label><input className="inp" value={wifiPass} onChange={e=>setWifiPass(e.target.value)}/></div>
              </div>
            )}
            {showPromo&&(
              <div className="card" style={{marginBottom:12}}>
                <p className="stit" style={{marginBottom:12}}>Ticker Message</p>
                <input className="inp" value={promoText} onChange={e=>setPromoText(e.target.value)} placeholder="Promotional message…"/>
              </div>
            )}
            <button className="btn bg" style={{width:"100%",padding:"14px"}} onClick={()=>showToast("✅ Display settings saved!")}>Save Settings</button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V13: BREAK & LUNCH SCHEDULER
// ══════════════════════════════════════════
function BreakSchedulerScreen({onClose}){
  const [barbers,setBarbers]=useState(BREAK_BARBERS);
  const [selBarber,setSelBarber]=useState(BREAK_BARBERS[0]);
  const [addBreak,setAddBreak]=useState(false);
  const [newBreakType,setNewBreakType]=useState("break");
  const [newBreakTime,setNewBreakTime]=useState("12PM");
  const [newBreakDur,setNewBreakDur]=useState(0.5);
  const [tab,setTab]=useState("schedule");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const TIME_SLOTS=["9AM","10AM","11AM","12PM","1PM","2PM","3PM","4PM","5PM","6PM","7PM"];
  const breakColor={lunch:C.gold,break:C.blue,personal:C.purple,blocked:C.red};
  const breakLabel={lunch:"Lunch",break:"Break",personal:"Personal",blocked:"Blocked"};

  const isBreak=(barber,slot)=>barber.breaks.find(b=>b.start===slot);
  const isWorking=(barber,slot)=>barber.shifts.includes(slot);

  const saveBreak=()=>{
    const updated=barbers.map(b=>b.id===selBarber.id?{...b,breaks:[...b.breaks,{type:newBreakType,start:newBreakTime,dur:newBreakDur}]}:b);
    setBarbers(updated);
    setSelBarber(updated.find(b=>b.id===selBarber.id));
    setAddBreak(false);
    showToast(`${breakLabel[newBreakType]} added for ${selBarber.name}!`);
  };

  const removeBreak=(barberId,breakStart)=>{
    const updated=barbers.map(b=>b.id===barberId?{...b,breaks:b.breaks.filter(br=>br.start!==breakStart)}:b);
    setBarbers(updated);
    setSelBarber(updated.find(b=>b.id===barberId));
    showToast("Break removed");
  };

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      {addBreak&&(
        <div className="ov" onClick={()=>setAddBreak(false)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:17,fontWeight:700,marginBottom:16}}>Add Break — {selBarber.name}</h3>
            <div style={{marginBottom:14}}>
              <label className="lbl">Break Type</label>
              <div style={{display:"flex",gap:8}}>
                {["break","lunch","personal","blocked"].map(t=>(
                  <div key={t} onClick={()=>setNewBreakType(t)} style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1px solid ${newBreakType===t?breakColor[t]:C.border}`,background:newBreakType===t?`${breakColor[t]}15`:C.surface,color:newBreakType===t?breakColor[t]:C.muted,textAlign:"center",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .18s",textTransform:"capitalize"}}>
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label className="lbl">Start Time</label>
              <select value={newBreakTime} onChange={e=>setNewBreakTime(e.target.value)} className="sel">
                {selBarber.shifts.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{marginBottom:20}}>
              <label className="lbl">Duration</label>
              <div style={{display:"flex",gap:8}}>
                {[{v:0.5,l:"30 min"},{v:1,l:"1 hour"},{v:1.5,l:"1.5 hr"},{v:2,l:"2 hours"}].map(d=>(
                  <div key={d.v} onClick={()=>setNewBreakDur(d.v)} style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1px solid ${newBreakDur===d.v?C.gold:C.border}`,background:newBreakDur===d.v?`${C.gold}12`:C.surface,color:newBreakDur===d.v?C.gold:C.muted,textAlign:"center",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .18s"}}>
                    {d.l}
                  </div>
                ))}
              </div>
            </div>
            <button className="btn bg" style={{width:"100%",padding:"13px",marginBottom:10}} onClick={saveBreak}>Add Break</button>
            <button className="bo" style={{width:"100%",padding:"12px"}} onClick={()=>setAddBreak(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Break Scheduler</h2>
          <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={()=>setAddBreak(true)}>+ Break</button>
        </div>
        {/* Barber selector */}
        <div style={{display:"flex",gap:10,overflowX:"auto",scrollbarWidth:"none",paddingBottom:4,marginBottom:8}}>
          {barbers.map(b=>(
            <div key={b.id} onClick={()=>setSelBarber(b)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",flexShrink:0}}>
              <div className="pav" style={{width:48,height:48,fontSize:18,background:`linear-gradient(135deg,${b.color},${b.color}88)`,border:`2px solid ${selBarber.id===b.id?C.gold:"transparent"}`,transition:"border .18s"}}>{b.avatar}</div>
              <span style={{fontSize:11,fontWeight:600,color:selBarber.id===b.id?C.gold:C.muted}}>{b.name}</span>
            </div>
          ))}
        </div>
        <div className="ptabs">
          {["schedule","all staff"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {tab==="schedule"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <p style={{fontSize:15,fontWeight:700}}>{selBarber.name}'s Day</p>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                {Object.entries(breakColor).map(([k,v])=>(
                  <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:8,height:8,borderRadius:2,background:v}}/>
                    <span style={{fontSize:9,color:C.muted,textTransform:"capitalize"}}>{k}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline view */}
            <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:20}}>
              {TIME_SLOTS.map(slot=>{
                const working=isWorking(selBarber,slot);
                const brk=isBreak(selBarber,slot);
                const bgColor=!working?"transparent":brk?`${breakColor[brk.type]}25`:`${selBarber.color}10`;
                const borderColor=!working?"transparent":brk?breakColor[brk.type]:`${selBarber.color}30`;
                return(
                  <div key={slot} style={{display:"flex",alignItems:"center",gap:10,opacity:working?1:0.3}}>
                    <span style={{fontSize:11,color:C.muted,width:38,textAlign:"right",flexShrink:0}}>{slot}</span>
                    <div style={{flex:1,height:36,borderRadius:10,background:bgColor,border:`1px solid ${borderColor}`,display:"flex",alignItems:"center",padding:"0 12px",gap:8,cursor:brk?"pointer":"default"}}
                      onClick={()=>brk&&removeBreak(selBarber.id,slot)}>
                      {brk?(
                        <>
                          <span style={{fontSize:14}}>{brk.type==="lunch"?"🍽":brk.type==="break"?"☕":brk.type==="personal"?"🚶":""}</span>
                          <span style={{fontSize:12,fontWeight:700,color:breakColor[brk.type]}}>{breakLabel[brk.type]}</span>
                          <span style={{fontSize:10,color:breakColor[brk.type],marginLeft:"auto"}}>{brk.dur<1?`${brk.dur*60}min`:`${brk.dur}hr`} · tap to remove</span>
                        </>
                      ):working?(
                        <span style={{fontSize:11,color:`${selBarber.color}80`,fontWeight:600}}>Available</span>
                      ):null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Breaks list */}
            {selBarber.breaks.length>0&&(
              <div className="card">
                <p className="stit" style={{marginBottom:10}}>Today's Breaks</p>
                {selBarber.breaks.map((brk,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<selBarber.breaks.length-1?`1px solid ${C.border}`:"none"}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <span style={{fontSize:18}}>{brk.type==="lunch"?"🍽":brk.type==="break"?"☕":"🚶"}</span>
                      <div>
                        <p style={{fontSize:13,fontWeight:700,textTransform:"capitalize"}}>{brk.type}</p>
                        <p style={{fontSize:11,color:C.muted}}>{brk.start} · {brk.dur<1?`${brk.dur*60} min`:`${brk.dur} hr`}</p>
                      </div>
                    </div>
                    <button className="bo" style={{fontSize:11,padding:"5px 12px",color:C.red,borderColor:"rgba(224,82,82,.3)"}} onClick={()=>removeBreak(selBarber.id,brk.start)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab==="all staff"&&(
          <>
            <p className="stit" style={{marginBottom:12}}>Shop Coverage Overview</p>
            {/* Grid header */}
            <div style={{display:"flex",marginBottom:8}}>
              <div style={{width:38,flexShrink:0}}/>
              {barbers.map(b=>(
                <div key={b.id} style={{flex:1,textAlign:"center"}}>
                  <div className="pav" style={{width:30,height:30,fontSize:12,background:`linear-gradient(135deg,${b.color},${b.color}88)`,margin:"0 auto"}}>{b.avatar}</div>
                  <p style={{fontSize:9,color:C.muted,marginTop:2}}>{b.name}</p>
                </div>
              ))}
            </div>
            {TIME_SLOTS.map(slot=>{
              const anyOnBreak=barbers.some(b=>isBreak(b,slot));
              const activeCount=barbers.filter(b=>isWorking(b,slot)&&!isBreak(b,slot)).length;
              return(
                <div key={slot} style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                  <span style={{fontSize:10,color:C.muted,width:38,textAlign:"right",flexShrink:0}}>{slot}</span>
                  {barbers.map(b=>{
                    const working=isWorking(b,slot);
                    const brk=isBreak(b,slot);
                    return(
                      <div key={b.id} style={{flex:1,height:28,borderRadius:6,margin:"0 2px",background:!working?"transparent":brk?`${breakColor[brk.type]}30`:`${b.color}25`,border:`1px solid ${!working?"transparent":brk?breakColor[brk.type]:`${b.color}40`}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>
                        {working&&(brk?<span style={{color:breakColor[brk.type]}}>B</span>:<span style={{color:b.color,fontWeight:700}}>✓</span>)}
                      </div>
                    );
                  })}
                  {anyOnBreak&&activeCount===0&&<span style={{fontSize:9,color:C.red,marginLeft:4,flexShrink:0}}>⚠️</span>}
                </div>
              );
            })}
            <p style={{fontSize:10,color:C.dim,marginTop:12,textAlign:"center"}}>✓ = Working · B = On Break · ⚠️ = No coverage</p>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V14: ACH / BANK TRANSFER PAYOUTS
// ══════════════════════════════════════════
function ACHPayoutsScreen({onClose}){
  const [accounts,setAccounts]=useState(BANK_ACCOUNTS);
  const [history,setHistory]=useState(PAYOUT_HISTORY);
  const [tab,setTab]=useState("balance");
  const [addBank,setAddBank]=useState(false);
  const [bankForm,setBankForm]=useState({name:"",bankName:"",routing:"",account:"",accountConfirm:"",type:"checking"});
  const [requestOpen,setRequestOpen]=useState(false);
  const [requestAmt,setRequestAmt]=useState(String(PENDING_BALANCE));
  const [requestAcct,setRequestAcct]=useState(1);
  const [requestSpeed,setRequestSpeed]=useState("ach");
  const [requestSent,setRequestSent]=useState(false);
  const [selPayout,setSelPayout]=useState(null);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const setF=k=>e=>setBankForm(f=>({...f,[k]:e.target.value}));

  const totalPaid=history.filter(p=>p.status==="completed").reduce((s,p)=>s+p.amount,0);
  const defaultAcct=accounts.find(a=>a.default)||accounts[0];

  const submitWithdrawal=()=>{
    const amt=parseFloat(requestAmt)||0;
    if(amt<=0||amt>PENDING_BALANCE){showToast("Invalid amount");return;}
    const newPayout={
      id:`PAY-2026-${String(history.length+1).padStart(3,"0")}`,
      date:"Today",amount:amt,
      method:requestSpeed==="instant"?"Instant":"ACH",
      bank:`${accounts.find(a=>a.id===requestAcct)?.bankName} ••${accounts.find(a=>a.id===requestAcct)?.last4}`,
      status:"processing",days:requestSpeed==="instant"?0:2,
      desc:requestSpeed==="instant"?"Instant transfer":"Standard ACH transfer"
    };
    setHistory(prev=>[newPayout,...prev]);
    setRequestOpen(false);setRequestSent(true);
    showToast(`💸 $${amt.toFixed(2)} transfer initiated!`);
  };

  const submitBank=()=>{
    if(!bankForm.bankName||!bankForm.routing||!bankForm.account){showToast("Fill in all required fields");return;}
    if(bankForm.account!==bankForm.accountConfirm){showToast("Account numbers don't match");return;}
    const newAcct={id:accounts.length+1,name:"Marcus Johnson",bankName:bankForm.bankName,last4:bankForm.account.slice(-4),routing:bankForm.routing,type:bankForm.type,default:false,verified:false,addedOn:"Today"};
    setAccounts(prev=>[...prev,newAcct]);
    setAddBank(false);setBankForm({name:"",bankName:"",routing:"",account:"",accountConfirm:"",type:"checking"});
    showToast("✅ Bank account added — verify in 1-2 business days");
  };

  if(addBank){
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setAddBank(false)}>← Back</button>
            <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Add Bank Account</h2>
            <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={submitBank}>Save</button>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:100}}>
          <div style={{background:`${C.blue}10`,border:`1px solid ${C.blue}25`,borderRadius:14,padding:14,marginBottom:20,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:22}}>🔒</span>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Bank info is encrypted and stored securely. Small verification deposits (under $1) will be sent to confirm ownership.</p>
          </div>
          <div className="card" style={{marginBottom:12}}>
            <p className="stit" style={{marginBottom:12}}>Account Details</p>
            <div style={{marginBottom:12}}><label className="lbl">Bank Name *</label><input value={bankForm.bankName} onChange={setF("bankName")} className="inp" placeholder="e.g. Chase, Wells Fargo"/></div>
            <div style={{marginBottom:12}}>
              <label className="lbl">Account Type</label>
              <div style={{display:"flex",gap:10}}>
                {["checking","savings"].map(t=>(
                  <div key={t} onClick={()=>setBankForm(f=>({...f,type:t}))} style={{flex:1,padding:"11px",borderRadius:12,border:`1px solid ${bankForm.type===t?C.gold:C.border}`,background:bankForm.type===t?`${C.gold}10`:C.surface,textAlign:"center",cursor:"pointer",transition:"all .18s"}}>
                    <div style={{fontSize:20,marginBottom:4}}>{t==="checking"?"🏦":"💰"}</div>
                    <div style={{fontSize:13,fontWeight:700,color:bankForm.type===t?C.gold:C.muted,textTransform:"capitalize"}}>{t}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:12}}><label className="lbl">Routing Number *</label><input value={bankForm.routing} onChange={setF("routing")} className="inp" placeholder="9-digit routing number" type="number" maxLength={9}/></div>
            <div style={{marginBottom:12}}><label className="lbl">Account Number *</label><input value={bankForm.account} onChange={setF("account")} className="inp" placeholder="Account number" type="password"/></div>
            <div><label className="lbl">Confirm Account Number *</label><input value={bankForm.accountConfirm} onChange={setF("accountConfirm")} className="inp" placeholder="Re-enter account number" type="password"/></div>
          </div>
          <div className="card" style={{marginBottom:20}}>
            <p className="stit" style={{marginBottom:10}}>Verification Process</p>
            {[{n:1,t:"We send two small deposits",d:"Usually under $1 each, within 1-2 business days"},{n:2,t:"You confirm the amounts",d:"Log in and enter the exact deposit amounts to verify"},{n:3,t:"Account is ready for payouts",d:"Start receiving ACH transfers within 2 business days"}].map(step=>(
              <div key={step.n} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"10px 0",borderBottom:step.n<3?`1px solid ${C.border}`:"none"}}>
                <div className="ach-step-num">{step.n}</div>
                <div><p style={{fontSize:13,fontWeight:700}}>{step.t}</p><p style={{fontSize:11,color:C.muted,marginTop:2}}>{step.d}</p></div>
              </div>
            ))}
          </div>
          <button className="btn bg" style={{width:"100%",padding:"15px",fontSize:15,fontWeight:700}} onClick={submitBank}>🏦 Add Bank Account</button>
        </div>
      </div>
    );
  }

  if(selPayout){
    const p=history.find(x=>x.id===selPayout);
    const statusC={completed:C.green,pending:C.orange,processing:C.blue,failed:C.red};
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setSelPayout(null)}>← Back</button>
            <h2 style={{fontSize:18,fontWeight:700}}>Payout Details</h2>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:80}}>
          <div style={{textAlign:"center",padding:"28px 0",background:`${statusC[p.status]}08`,border:`1px solid ${statusC[p.status]}25`,borderRadius:20,marginBottom:20}}>
            <div style={{fontSize:48,marginBottom:8}}>{p.status==="completed"?"✅":p.status==="processing"?"⏳":p.status==="failed"?"❌":"🕐"}</div>
            <p style={{fontSize:32,fontWeight:900,fontFamily:"'Playfair Display',serif",color:statusC[p.status]}}>${p.amount.toFixed(2)}</p>
            <p style={{fontSize:14,color:C.muted,marginTop:4,textTransform:"capitalize"}}>{p.status}</p>
          </div>
          <div className="card" style={{marginBottom:16}}>
            {[{l:"Transaction ID",v:p.id},{l:"Date",v:p.date},{l:"Method",v:p.method},{l:"Bank Account",v:p.bank},{l:"Processing Time",v:p.days===0?"Instant":p.days===1?"1 business day":`${p.days} business days`},{l:"Description",v:p.desc}].map(row=>(
              <div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{row.l}</span>
                <span style={{fontSize:13,fontWeight:600,maxWidth:"58%",textAlign:"right"}}>{row.v}</span>
              </div>
            ))}
          </div>
          {p.status==="failed"&&<button className="btn bg" style={{width:"100%",padding:"13px"}} onClick={()=>{showToast("Retrying transfer...");setSelPayout(null);}}>🔄 Retry Transfer</button>}
          <button className="bo" style={{width:"100%",padding:"12px",marginTop:8}} onClick={()=>showToast("Receipt downloaded!")}>📄 Download Receipt</button>
        </div>
      </div>
    );
  }

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      {requestOpen&&(
        <div className="ov" onClick={()=>setRequestOpen(false)}>
          <div className="mod" onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:17,fontWeight:700,marginBottom:4}}>Request Payout</h3>
            <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Available: ${PENDING_BALANCE.toFixed(2)}</p>
            <label className="lbl">Amount ($)</label>
            <input type="number" value={requestAmt} onChange={e=>setRequestAmt(e.target.value)} className="inp" style={{marginBottom:4}}/>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {["500","1000","1500",String(PENDING_BALANCE)].map(a=>(
                <div key={a} onClick={()=>setRequestAmt(a)} style={{flex:1,padding:"8px 2px",borderRadius:10,border:`1px solid ${requestAmt===a?C.gold:C.border}`,background:requestAmt===a?`${C.gold}12`:C.surface,color:requestAmt===a?C.gold:C.muted,textAlign:"center",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  {a===String(PENDING_BALANCE)?"All":("$"+a)}
                </div>
              ))}
            </div>
            <label className="lbl">To Account</label>
            <select value={requestAcct} onChange={e=>setRequestAcct(Number(e.target.value))} className="sel" style={{marginBottom:14}}>
              {accounts.filter(a=>a.verified).map(a=><option key={a.id} value={a.id}>{a.bankName} ••{a.last4} {a.default?"(Default)":""}</option>)}
            </select>
            <label className="lbl">Transfer Speed</label>
            <div style={{display:"flex",gap:10,marginBottom:20}}>
              {[{id:"ach",l:"Standard ACH",sub:"2 business days · Free",icon:"🏦"},{id:"instant",l:"Instant Transfer",sub:"Within minutes · 1.5% fee",icon:"⚡"}].map(opt=>(
                <div key={opt.id} onClick={()=>setRequestSpeed(opt.id)} style={{flex:1,padding:"12px 8px",borderRadius:14,border:`1px solid ${requestSpeed===opt.id?C.gold:C.border}`,background:requestSpeed===opt.id?`${C.gold}08`:C.surface,cursor:"pointer",transition:"all .18s"}}>
                  <div style={{fontSize:20,marginBottom:4,textAlign:"center"}}>{opt.icon}</div>
                  <p style={{fontSize:12,fontWeight:700,textAlign:"center",color:requestSpeed===opt.id?C.gold:C.text}}>{opt.l}</p>
                  <p style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:2}}>{opt.sub}</p>
                </div>
              ))}
            </div>
            <button className="btn bg" style={{width:"100%",padding:"14px",marginBottom:10,fontSize:14,fontWeight:700}} onClick={submitWithdrawal}>
              💸 Transfer ${parseFloat(requestAmt||0).toFixed(2)}
            </button>
            <button className="bo" style={{width:"100%",padding:"12px"}} onClick={()=>setRequestOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Bank Payouts</h2>
          <button className="bgh" style={{padding:"8px 14px",fontSize:12}} onClick={()=>setAddBank(true)}>+ Bank</button>
        </div>
        <div className="bank-card">
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,color:"rgba(76,175,122,.6)",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Available Balance</p>
            <p style={{fontSize:38,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.green,marginTop:4}}>${requestSent?"0.00":PENDING_BALANCE.toFixed(2)}</p>
            <p style={{fontSize:12,color:"rgba(76,175,122,.5)",marginTop:2}}>Ready to transfer · Week ending Feb 28</p>
          </div>
          <div style={{display:"flex",gap:12,marginBottom:16}}>
            <div><p style={{fontSize:14,fontWeight:700,color:C.text}}>${totalPaid.toLocaleString()}</p><p style={{fontSize:10,color:"rgba(76,175,122,.5)"}}>Lifetime paid out</p></div>
            <div><p style={{fontSize:14,fontWeight:700,color:C.text}}>{history.filter(p=>p.status==="completed").length}</p><p style={{fontSize:10,color:"rgba(76,175,122,.5)"}}>Transfers</p></div>
          </div>
          <button onClick={()=>setRequestOpen(true)} style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:C.green,color:"#000",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"'Playfair Display',serif"}}>
            💸 Request Payout
          </button>
        </div>
        <div className="ptabs">
          {["balance","accounts","history"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {tab==="balance"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>This Week's Earnings Breakdown</p>
            {[{l:"Haircut Services",v:1840,c:C.gold},{l:"Tip Income",v:420,c:C.green},{l:"Product Sales",v:180,c:C.blue},{l:"Gift Card Redemptions",v:200,c:C.purple}].map(row=>(
              <div key={row.l} className="payout-row">
                <span style={{fontSize:14,fontWeight:500}}>{row.l}</span>
                <span style={{fontSize:15,fontWeight:800,color:row.c}}>${row.v.toFixed(2)}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"13px 0",marginTop:4,borderTop:`2px solid ${C.gold}40`}}>
              <span style={{fontSize:15,fontWeight:700}}>Total Available</span>
              <span style={{fontSize:18,fontWeight:900,color:C.gold}}>${PENDING_BALANCE.toFixed(2)}</span>
            </div>
            <div className="card" style={{marginTop:12}}>
              <p className="stit" style={{marginBottom:10}}>Payout Schedule</p>
              {[{l:"Standard ACH",v:"Every Friday · 2 business days",icon:"🏦"},{l:"Instant Transfer",v:"Any time · 1.5% fee (min $0.50)",icon:"⚡"},{l:"Manual Request",v:"On-demand via this screen",icon:"📲"}].map(row=>(
                <div key={row.l} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:20}}>{row.icon}</span>
                  <div><p style={{fontSize:13,fontWeight:700}}>{row.l}</p><p style={{fontSize:11,color:C.muted}}>{row.v}</p></div>
                </div>
              ))}
            </div>
          </>
        )}
        {tab==="accounts"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Linked Bank Accounts</p>
            {accounts.map(acct=>(
              <div key={acct.id} className="card" style={{marginBottom:10}}>
                <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
                  <div style={{width:46,height:46,borderRadius:14,background:`${C.green}15`,border:`1px solid ${C.green}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏦</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                      <p style={{fontSize:15,fontWeight:700}}>{acct.bankName}</p>
                      {acct.default&&<span style={{fontSize:10,background:`${C.gold}20`,color:C.gold,padding:"2px 8px",borderRadius:20,fontWeight:700}}>Default</span>}
                      {!acct.verified&&<span style={{fontSize:10,background:`${C.orange}20`,color:C.orange,padding:"2px 8px",borderRadius:20,fontWeight:700}}>Pending</span>}
                    </div>
                    <p style={{fontSize:12,color:C.muted}}>{acct.type.charAt(0).toUpperCase()+acct.type.slice(1)} ••••{acct.last4} · Added {acct.addedOn}</p>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {!acct.default&&acct.verified&&<button className="bgh" style={{flex:1,padding:"9px",fontSize:12}} onClick={()=>{setAccounts(prev=>prev.map(a=>({...a,default:a.id===acct.id})));showToast("Default account updated!");}}>Set Default</button>}
                  {!acct.verified&&<button className="btn bg" style={{flex:1,padding:"9px",fontSize:12}} onClick={()=>{setAccounts(prev=>prev.map(a=>a.id===acct.id?{...a,verified:true}:a));showToast("Account verified!");}}>Verify Account</button>}
                  <button className="bo" style={{flex:1,padding:"9px",fontSize:12,color:C.red,borderColor:"rgba(224,82,82,.3)"}} onClick={()=>{setAccounts(prev=>prev.filter(a=>a.id!==acct.id));showToast("Account removed");}}>Remove</button>
                </div>
              </div>
            ))}
            <button className="bo" style={{width:"100%",padding:"13px",marginTop:4}} onClick={()=>setAddBank(true)}>+ Add Bank Account</button>
          </>
        )}
        {tab==="history"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Payout History</p>
            {history.map((p,i)=>(
              <div key={i} className="payout-row" style={{cursor:"pointer"}} onClick={()=>setSelPayout(p.id)}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{width:38,height:38,borderRadius:10,background:p.status==="completed"?`${C.green}15`:p.status==="failed"?`${C.red}15`:`${C.blue}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
                    {p.status==="completed"?"💸":p.status==="failed"?"❌":"⏳"}
                  </div>
                  <div>
                    <p style={{fontSize:13,fontWeight:700}}>${p.amount.toFixed(2)}</p>
                    <p style={{fontSize:11,color:C.muted}}>{p.date} · {p.bank}</p>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <span className={`payout-status ${p.status}`}>{p.status}</span>
                  <p style={{fontSize:10,color:C.dim,marginTop:4}}>{p.method}</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V14: PRICE OVERRIDE & DISCOUNT APPROVALS
// ══════════════════════════════════════════
function PriceOverrideScreen({onClose}){
  const [overrides,setOverrides]=useState(OVERRIDES_INIT);
  const [tab,setTab]=useState("pending");
  const [selOverride,setSelOverride]=useState(null);
  const [pinEntry,setPinEntry]=useState("");
  const [pinAction,setPinAction]=useState(null); // "approve" | "deny"
  const [pinShake,setPinShake]=useState(false);
  const [settings,setSettings]=useState({requirePin:true,managerPin:"1234",autoApproveUnder:10,maxDiscount:30,notifyOnRequest:true});
  const [newReqOpen,setNewReqOpen]=useState(false);
  const [newForm,setNewForm]=useState({client:"",service:"",original:"",requested:"",reason:""});
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const pending=overrides.filter(o=>o.status==="pending");
  const approved=overrides.filter(o=>o.status==="approved");
  const denied=overrides.filter(o=>o.status==="denied");
  const typeColor={loyalty:C.gold,promo:C.blue,comp:C.purple,military:C.green,personal:C.orange};
  const typeIcon={loyalty:"🏆",promo:"🏷",comp:"✋",military:"🎖",personal:"👤"};

  const handlePinKey=(k)=>{
    if(k==="del"){setPinEntry(p=>p.slice(0,-1));return;}
    if(pinEntry.length>=4)return;
    const next=pinEntry+k;
    setPinEntry(next);
    if(next.length===4){
      if(next===settings.managerPin){
        const action=pinAction;
        setOverrides(prev=>prev.map(o=>o.id===selOverride?{...o,status:action==="approve"?"approved":"denied"}:o));
        showToast(action==="approve"?"✅ Override approved!":"❌ Override denied");
        setPinEntry("");setPinAction(null);setSelOverride(null);
      } else {
        setPinShake(true);
        setTimeout(()=>{setPinShake(false);setPinEntry("");},450);
      }
    }
  };

  if(selOverride&&pinAction){
    const ovr=overrides.find(o=>o.id===selOverride);
    return(
      <div className="modfull" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
        <Toast msg={toast}/>
        <div style={{textAlign:"center",marginBottom:28}}>
          <p style={{fontSize:13,color:C.muted,marginBottom:4}}>Manager PIN to {pinAction}</p>
          <p style={{fontSize:16,fontWeight:700}}>{ovr.client} · {ovr.service}</p>
          <p style={{fontSize:15,color:C.gold,fontWeight:800,marginTop:4}}>${ovr.original} → ${ovr.requested}</p>
        </div>
        <div className={`pin-screen${pinShake?" pin-shake":""}`}>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:32}}>
            {[0,1,2,3].map(i=>(
              <div key={i} className={`pin-dot${i<pinEntry.length?" filled":""}`}/>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {["1","2","3","4","5","6","7","8","9","","0","del"].map((k,i)=>(
              <button key={i} className={`pin-key${k==="del"?" del":""}`} onClick={()=>k&&handlePinKey(k)} disabled={!k&&k!=="0"}>
                {k==="del"?"⌫":k}
              </button>
            ))}
          </div>
        </div>
        <button className="bo" style={{marginTop:24,padding:"10px 28px",fontSize:13}} onClick={()=>{setPinEntry("");setPinAction(null);}}>Cancel</button>
      </div>
    );
  }

  if(selOverride){
    const ovr=overrides.find(o=>o.id===selOverride);
    const savings=ovr.original-ovr.requested;
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setSelOverride(null)}>← Back</button>
            <h2 style={{fontSize:18,fontWeight:700}}>Override Request</h2>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:80}}>
          {/* Price comparison */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:20,marginBottom:16,textAlign:"center"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:12}}>
              <div><p style={{fontSize:28,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.muted,textDecoration:"line-through"}}>${ovr.original}</p><p style={{fontSize:11,color:C.dim}}>Original</p></div>
              <span style={{fontSize:22}}>→</span>
              <div><p style={{fontSize:36,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.gold}}>${ovr.requested}</p><p style={{fontSize:11,color:C.muted}}>Requested</p></div>
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:16}}>
              <span style={{fontSize:12,background:`${C.red}15`,color:C.red,padding:"4px 12px",borderRadius:20,fontWeight:700}}>-${savings} ({ovr.discount} off)</span>
              <span style={{fontSize:12,background:`${typeColor[ovr.type]||C.gold}15`,color:typeColor[ovr.type]||C.gold,padding:"4px 12px",borderRadius:20,fontWeight:700}}>{typeIcon[ovr.type]} {ovr.type}</span>
            </div>
          </div>
          <div className="card" style={{marginBottom:16}}>
            {[{l:"Requested by",v:ovr.barber},{l:"Client",v:ovr.client},{l:"Service",v:ovr.service},{l:"Time",v:ovr.time},{l:"Reason",v:ovr.reason}].map(row=>(
              <div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>{row.l}</span>
                <span style={{fontSize:13,fontWeight:600,maxWidth:"60%",textAlign:"right"}}>{row.v}</span>
              </div>
            ))}
          </div>
          {ovr.status==="pending"?(
            <div style={{display:"flex",gap:10}}>
              <button style={{flex:1,padding:"14px",borderRadius:14,border:"none",background:C.green,color:"#000",fontWeight:800,fontSize:15,cursor:"pointer"}} onClick={()=>{if(settings.requirePin){setPinAction("approve");}else{setOverrides(prev=>prev.map(o=>o.id===selOverride?{...o,status:"approved"}:o));showToast("✅ Approved!");setSelOverride(null);}}}>
                ✅ Approve
              </button>
              <button style={{flex:1,padding:"14px",borderRadius:14,border:"none",background:C.red,color:"white",fontWeight:800,fontSize:15,cursor:"pointer"}} onClick={()=>{if(settings.requirePin){setPinAction("deny");}else{setOverrides(prev=>prev.map(o=>o.id===selOverride?{...o,status:"denied"}:o));showToast("❌ Denied");setSelOverride(null);}}}>
                ❌ Deny
              </button>
            </div>
          ):(
            <div style={{textAlign:"center",padding:16,borderRadius:14,background:ovr.status==="approved"?`${C.green}10`:`${C.red}10`,border:`1px solid ${ovr.status==="approved"?C.green:C.red}30`}}>
              <p style={{fontSize:16,fontWeight:700,color:ovr.status==="approved"?C.green:C.red}}>{ovr.status==="approved"?"✅ Approved":"❌ Denied"}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Price Overrides</h2>
          <button className="btn bg" style={{padding:"8px 14px",fontSize:12}} onClick={()=>setNewReqOpen(true)}>+ Request</button>
        </div>
        {pending.length>0&&(
          <div style={{background:`${C.orange}12`,border:`1px solid ${C.orange}30`,borderRadius:14,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:18}}>🔔</span>
              <p style={{fontSize:13,fontWeight:700}}>{pending.length} pending approval{pending.length>1?"s":""}</p>
            </div>
            {pending.some(o=>o.urgent)&&<span style={{fontSize:11,background:`${C.red}20`,color:C.red,padding:"3px 10px",borderRadius:20,fontWeight:700}}>⚡ Urgent</span>}
          </div>
        )}
        <div className="ptabs">
          {[["pending",pending.length],["approved",approved.length],["denied",denied.length],["settings",null]].map(([t,n])=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize",position:"relative"}}>
              {t}
              {n>0&&<span style={{position:"absolute",top:-6,right:-4,width:16,height:16,borderRadius:"50%",background:t==="pending"?C.orange:C.green,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",color:"#000"}}>{n}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {(tab==="pending"||tab==="approved"||tab==="denied")&&(()=>{
          const list=tab==="pending"?pending:tab==="approved"?approved:denied;
          if(list.length===0)return<div style={{textAlign:"center",padding:40}}><div style={{fontSize:48,marginBottom:12}}>{tab==="pending"?"✅":"📋"}</div><p style={{fontSize:15,fontWeight:700,marginBottom:4}}>{tab==="pending"?"All caught up!":"No "+tab+" overrides"}</p><p style={{fontSize:12,color:C.muted}}>Override requests will appear here</p></div>;
          return list.map(ovr=>(
            <div key={ovr.id} className="override-card" style={{borderColor:ovr.urgent&&ovr.status==="pending"?`${C.orange}50`:C.border}} onClick={()=>setSelOverride(ovr.id)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
                    <p style={{fontSize:15,fontWeight:700}}>{ovr.client}</p>
                    {ovr.urgent&&ovr.status==="pending"&&<span style={{fontSize:10,background:`${C.red}20`,color:C.red,padding:"2px 8px",borderRadius:20,fontWeight:700}}>⚡ Urgent</span>}
                  </div>
                  <p style={{fontSize:12,color:C.muted}}>{ovr.service} · by {ovr.barber}</p>
                </div>
                <span className={`override-status ${ovr.status}`}>{ovr.status}</span>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:700,color:C.muted,textDecoration:"line-through"}}>${ovr.original}</span>
                <span style={{fontSize:13,color:C.dim}}>→</span>
                <span style={{fontSize:16,fontWeight:900,color:C.gold}}>${ovr.requested}</span>
                <span style={{fontSize:11,background:`${C.red}15`,color:C.red,padding:"2px 8px",borderRadius:20,fontWeight:700,marginLeft:"auto"}}>-{ovr.discount}</span>
              </div>
              <p style={{fontSize:12,color:C.muted}}>{typeIcon[ovr.type]} {ovr.reason}</p>
            </div>
          ));
        })()}
        {tab==="settings"&&(
          <>
            <div className="card" style={{marginBottom:12}}>
              <p className="stit" style={{marginBottom:12}}>Approval Settings</p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <div><p style={{fontSize:14,fontWeight:600}}>Require Manager PIN</p><p style={{fontSize:11,color:C.muted}}>PIN must be entered for all approvals</p></div>
                <Tog on={settings.requirePin} toggle={()=>setSettings(s=>({...s,requirePin:!s.requirePin}))}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <div><p style={{fontSize:14,fontWeight:600}}>Push Notifications</p><p style={{fontSize:11,color:C.muted}}>Alert when new override is requested</p></div>
                <Tog on={settings.notifyOnRequest} toggle={()=>setSettings(s=>({...s,notifyOnRequest:!s.notifyOnRequest}))}/>
              </div>
              <div style={{padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <p style={{fontSize:14,fontWeight:600,marginBottom:8}}>Auto-Approve Under ($)</p>
                <div style={{display:"flex",gap:8}}>
                  {[0,5,10,15].map(v=>(
                    <div key={v} onClick={()=>setSettings(s=>({...s,autoApproveUnder:v}))} style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1px solid ${settings.autoApproveUnder===v?C.gold:C.border}`,background:settings.autoApproveUnder===v?`${C.gold}12`:C.surface,color:settings.autoApproveUnder===v?C.gold:C.muted,textAlign:"center",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .18s"}}>
                      {v===0?"Off":`$${v}`}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{paddingTop:10}}>
                <p style={{fontSize:14,fontWeight:600,marginBottom:8}}>Max Allowed Discount</p>
                <div style={{display:"flex",gap:8}}>
                  {[10,20,30,50,100].map(v=>(
                    <div key={v} onClick={()=>setSettings(s=>({...s,maxDiscount:v}))} style={{flex:1,padding:"9px 2px",borderRadius:10,border:`1px solid ${settings.maxDiscount===v?C.gold:C.border}`,background:settings.maxDiscount===v?`${C.gold}12`:C.surface,color:settings.maxDiscount===v?C.gold:C.muted,textAlign:"center",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .18s"}}>
                      {v}%
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {settings.requirePin&&(
              <div className="card" style={{marginBottom:12}}>
                <p className="stit" style={{marginBottom:10}}>Manager PIN</p>
                <p style={{fontSize:12,color:C.muted,marginBottom:10}}>4-digit PIN required to approve or deny overrides</p>
                <input type="password" maxLength={4} className="inp" placeholder="Enter new PIN (4 digits)" onChange={e=>e.target.value.length===4&&setSettings(s=>({...s,managerPin:e.target.value}))}/>
              </div>
            )}
            <button className="btn bg" style={{width:"100%",padding:"14px"}} onClick={()=>showToast("✅ Settings saved!")}>Save Settings</button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V14: REVENUE BY SERVICE REPORT
// ══════════════════════════════════════════
function RevenueByServiceScreen({onClose}){
  const [period,setPeriod]=useState("month");
  const [tab,setTab]=useState("overview");
  const [selService,setSelService]=useState(null);
  const [chartType,setChartType]=useState("bar"); // bar | donut
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const totalRevenue=SERVICE_REVENUE_DATA.reduce((s,svc)=>s+svc.revenue,0);
  const totalServices=SERVICE_REVENUE_DATA.reduce((s,svc)=>s+svc.count,0);

  // Simple donut chart using SVG
  const DonutChart=()=>{
    const size=180;const r=60;const cx=size/2;const cy=size/2;
    const circumference=2*Math.PI*r;
    let accum=0;
    const slices=SERVICE_REVENUE_DATA.slice(0,5).map(svc=>{
      const pct=svc.revenue/totalRevenue;
      const dash=pct*circumference;
      const offset=-(accum*circumference);
      accum+=pct;
      return{...svc,dash,offset};
    });
    return(
      <svg width={size} height={size} style={{display:"block",margin:"0 auto"}}>
        {slices.map((s,i)=>(
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={28}
            strokeDasharray={`${s.dash} ${circumference-s.dash}`}
            strokeDashoffset={s.offset}
            className="util-ring"
            style={{transform:`rotate(-90deg)`,transformOrigin:`${cx}px ${cy}px`}}
          />
        ))}
        <text x={cx} y={cy-8} textAnchor="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="'Playfair Display',serif">${(totalRevenue/1000).toFixed(1)}k</text>
        <text x={cx} y={cy+12} textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize="11">total</text>
      </svg>
    );
  };

  if(selService){
    const svc=SERVICE_REVENUE_DATA.find(s=>s.name===selService);
    const barbers=SVC_BARBER_BREAKDOWN[svc.name]||{};
    const maxBarber=Math.max(...Object.values(barbers),1);
    return(
      <div className="modfull">
        <Toast msg={toast}/>
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
            <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setSelService(null)}>← Back</button>
            <h2 style={{fontSize:18,fontWeight:700}}>{svc.icon} {svc.name}</h2>
          </div>
        </div>
        <div className="sec screen" style={{paddingBottom:80}}>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[{l:"Revenue",v:`$${svc.revenue.toLocaleString()}`,c:svc.color},{l:"Services",v:svc.count,c:C.blue},{l:"Avg Ticket",v:`$${svc.avg}`,c:C.green},{l:"Trend",v:svc.trend,c:svc.trend.startsWith("+")?C.green:C.red}].map(s=>(
              <div key={s.l} style={{flex:1,background:C.card,border:`1px solid ${s.c}25`,borderRadius:12,padding:"10px 4px",textAlign:"center"}}>
                <p style={{fontSize:15,fontWeight:800,color:s.c}}>{s.v}</p>
                <p style={{fontSize:9,color:C.muted,marginTop:2}}>{s.l}</p>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:12}}>
            <p className="stit" style={{marginBottom:12}}>Revenue % of Total</p>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:13,color:C.muted}}>Share of total revenue</span>
              <span style={{fontSize:13,fontWeight:700,color:svc.color}}>{((svc.revenue/totalRevenue)*100).toFixed(1)}%</span>
            </div>
            <div style={{height:10,background:C.surface,borderRadius:5,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${(svc.revenue/totalRevenue)*100}%`,background:`linear-gradient(90deg,${svc.color}88,${svc.color})`,borderRadius:5}}/>
            </div>
          </div>
          {Object.keys(barbers).length>0&&(
            <div className="card" style={{marginBottom:12}}>
              <p className="stit" style={{marginBottom:12}}>Revenue by Barber</p>
              {Object.entries(barbers).map(([name,rev])=>(
                <div key={name} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:13,fontWeight:600}}>{name}</span>
                    <span style={{fontSize:13,fontWeight:700,color:C.gold}}>${rev.toLocaleString()}</span>
                  </div>
                  <div style={{height:7,background:C.surface,borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${(rev/maxBarber)*100}%`,background:`linear-gradient(90deg,${C.gold}66,${C.gold})`,borderRadius:3,transition:"width .7s ease"}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="card">
            <p className="stit" style={{marginBottom:12}}>Monthly Trend</p>
            {["Nov","Dec","Jan","Feb"].map((m,i)=>{
              const vals=[svc.revenue*0.72,svc.revenue*0.88,svc.revenue*0.94,svc.revenue];
              const v=vals[i];
              return(
                <div key={m} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{fontSize:12,color:C.muted,width:28}}>{m}</span>
                  <div style={{flex:1,height:24,background:C.surface,borderRadius:6,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${(v/svc.revenue)*100}%`,background:`${svc.color}30`,borderRadius:6,display:"flex",alignItems:"center",paddingLeft:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:svc.color}}>${(v/1000).toFixed(1)}k</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Revenue by Service</h2>
          <button className="bgh" style={{padding:"8px 14px",fontSize:12}} onClick={()=>showToast("Report exported!")}>Export</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {["week","month","quarter","year"].map(p=>(
            <div key={p} className={`svc-cat-chip${period===p?" sel":""}`} onClick={()=>setPeriod(p)} style={{textTransform:"capitalize"}}>{p}</div>
          ))}
        </div>
        <div className="ptabs">
          {["overview","ranking","trends"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {tab==="overview"&&(
          <>
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              <div style={{flex:1,background:C.card,border:`1px solid ${C.gold}25`,borderRadius:14,padding:"12px",textAlign:"center"}}>
                <p style={{fontSize:22,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.gold}}>${(totalRevenue/1000).toFixed(1)}k</p>
                <p style={{fontSize:10,color:C.muted}}>Total Revenue</p>
              </div>
              <div style={{flex:1,background:C.card,border:`1px solid ${C.blue}25`,borderRadius:14,padding:"12px",textAlign:"center"}}>
                <p style={{fontSize:22,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.blue}}>{totalServices}</p>
                <p style={{fontSize:10,color:C.muted}}>Total Services</p>
              </div>
              <div style={{flex:1,background:C.card,border:`1px solid ${C.green}25`,borderRadius:14,padding:"12px",textAlign:"center"}}>
                <p style={{fontSize:22,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.green}}>${Math.round(totalRevenue/totalServices)}</p>
                <p style={{fontSize:10,color:C.muted}}>Avg Ticket</p>
              </div>
            </div>

            {/* Chart type toggle */}
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              {[{id:"bar",l:"📊 Bar"},{ id:"donut",l:"🍩 Donut"}].map(c=>(
                <div key={c.id} onClick={()=>setChartType(c.id)} style={{flex:1,padding:"10px",borderRadius:12,border:`1px solid ${chartType===c.id?C.gold:C.border}`,background:chartType===c.id?`${C.gold}10`:C.surface,textAlign:"center",fontSize:13,fontWeight:700,color:chartType===c.id?C.gold:C.muted,cursor:"pointer",transition:"all .18s"}}>
                  {c.l}
                </div>
              ))}
            </div>

            {chartType==="bar"?(
              <div className="card" style={{marginBottom:14}}>
                <p className="stit" style={{marginBottom:12}}>Revenue by Service</p>
                {SERVICE_REVENUE_DATA.map((svc,i)=>(
                  <div key={svc.name} style={{marginBottom:10,cursor:"pointer"}} onClick={()=>setSelService(svc.name)}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600}}>{svc.icon} {svc.name}</span>
                      <span style={{fontSize:13,fontWeight:700,color:svc.color}}>${svc.revenue.toLocaleString()}</span>
                    </div>
                    <div style={{height:8,background:C.surface,borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${svc.pct}%`,background:`linear-gradient(90deg,${svc.color}55,${svc.color})`,borderRadius:4,transition:"width .8s ease"}}/>
                    </div>
                  </div>
                ))}
              </div>
            ):(
              <>
                <div style={{marginBottom:16}}>
                  <DonutChart/>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
                  {SERVICE_REVENUE_DATA.slice(0,5).map(svc=>(
                    <div key={svc.name} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div className="rev-legend-dot" style={{background:svc.color}}/>
                      <span style={{fontSize:11,color:C.muted}}>{svc.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="stit" style={{marginBottom:10}}>Top Earners</p>
            {SERVICE_REVENUE_DATA.slice(0,3).map((svc,i)=>(
              <div key={svc.name} className="service-rev-row" onClick={()=>setSelService(svc.name)} style={{cursor:"pointer"}}>
                <div className="svc-rank-bubble" style={{background:i===0?"rgba(201,168,76,.2)":i===1?"rgba(91,156,246,.15)":"rgba(167,139,250,.15)",color:i===0?C.gold:i===1?C.blue:C.purple}}>#{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                    <p style={{fontSize:14,fontWeight:700}}>{svc.icon} {svc.name}</p>
                    <p style={{fontSize:15,fontWeight:800,color:svc.color}}>${svc.revenue.toLocaleString()}</p>
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:3}}>
                    <span style={{fontSize:11,color:C.muted}}>{svc.count} services</span>
                    <span style={{fontSize:11,color:C.muted}}>Avg ${svc.avg}</span>
                    <span style={{fontSize:11,fontWeight:700,color:svc.trend.startsWith("+")?C.green:C.red}}>{svc.trend}</span>
                  </div>
                </div>
                <span style={{color:C.dim}}>›</span>
              </div>
            ))}
          </>
        )}

        {tab==="ranking"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>All Services Ranked by Revenue</p>
            {SERVICE_REVENUE_DATA.map((svc,i)=>(
              <div key={svc.name} className="card" style={{marginBottom:8,cursor:"pointer"}} onClick={()=>setSelService(svc.name)}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div className="svc-rank-bubble" style={{background:`${svc.color}15`,color:svc.color}}>{i+1}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <p style={{fontSize:14,fontWeight:700}}>{svc.icon} {svc.name}</p>
                      <span style={{fontSize:11,fontWeight:700,color:svc.trend.startsWith("+")?C.green:C.red}}>{svc.trend}</span>
                    </div>
                    <div style={{height:6,background:C.surface,borderRadius:3,overflow:"hidden",marginBottom:4}}>
                      <div style={{height:"100%",width:`${svc.pct}%`,background:`linear-gradient(90deg,${svc.color}66,${svc.color})`,borderRadius:3}}/>
                    </div>
                    <div style={{display:"flex",gap:12}}>
                      <span style={{fontSize:11,fontWeight:700,color:svc.color}}>${svc.revenue.toLocaleString()}</span>
                      <span style={{fontSize:11,color:C.muted}}>{svc.count} booked</span>
                      <span style={{fontSize:11,color:C.muted}}>${svc.avg} avg</span>
                      <span style={{fontSize:11,color:C.muted}}>{((svc.revenue/totalRevenue)*100).toFixed(1)}% of total</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab==="trends"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Month-over-Month Growth</p>
            {SERVICE_REVENUE_DATA.sort((a,b)=>parseFloat(b.trend)-parseFloat(a.trend)).map(svc=>(
              <div key={svc.name} className="service-rev-row">
                <span style={{fontSize:20,width:28,textAlign:"center"}}>{svc.icon}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                    <p style={{fontSize:14,fontWeight:700}}>{svc.name}</p>
                    <span style={{fontSize:14,fontWeight:800,color:svc.trend.startsWith("+")?C.green:C.red}}>{svc.trend}</span>
                  </div>
                  <p style={{fontSize:11,color:C.muted,marginTop:2}}>${svc.revenue.toLocaleString()} this period</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// V14: OCCUPANCY & UTILIZATION RATE
// ══════════════════════════════════════════
function OccupancyScreen({onClose}){
  const [tab,setTab]=useState("heatmap");
  const [selCell,setSelCell]=useState(null);
  const [selBarber,setSelBarber]=useState(null);
  const [period,setPeriod]=useState("week");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const avgOcc=Math.round(OCC_MATRIX.flat().reduce((a,b)=>a+b,0)/OCC_MATRIX.flat().length);
  const peakDay=OCC_DAYS[OCC_MATRIX.findIndex(row=>Math.max(...row)===Math.max(...OCC_MATRIX.map(r=>Math.max(...r))))];
  const peakHour=OCC_HOURS[OCC_MATRIX[5].indexOf(Math.max(...OCC_MATRIX[5]))];

  const cellColor=(v)=>{
    if(v===0)return"transparent";
    if(v<25)return"rgba(76,175,122,.12)";
    if(v<50)return"rgba(76,175,122,.28)";
    if(v<70)return"rgba(201,168,76,.35)";
    if(v<85)return"rgba(201,168,76,.6)";
    if(v<95)return"rgba(245,158,11,.75)";
    return"rgba(224,82,82,.85)";
  };
  const cellTextColor=(v)=>v>=70?"rgba(0,0,0,.7)":"rgba(255,255,255,.7)";

  // Radial gauge
  const Gauge=({value,color,size=80})=>{
    const r=28;const circ=2*Math.PI*r;const dash=(value/100)*circ;
    return(
      <svg width={size} height={size} style={{display:"block"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={8}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ-dash}`}
          strokeDashoffset={circ*0.25}
          strokeLinecap="round"/>
        <text x={size/2} y={size/2+5} textAnchor="middle" fill={color} fontSize="14" fontWeight="800">{value}%</text>
      </svg>
    );
  };

  return(
    <div className="modfull">
      <Toast msg={toast}/>
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button className="bo" style={{padding:"8px 14px",fontSize:13}} onClick={onClose}>← Back</button>
          <h2 className="pf" style={{fontSize:20,fontWeight:700}}>Occupancy & Utilization</h2>
          <button className="bgh" style={{padding:"8px 14px",fontSize:12}} onClick={()=>showToast("Report exported!")}>Export</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {["week","month","quarter"].map(p=>(
            <div key={p} className={`svc-cat-chip${period===p?" sel":""}`} onClick={()=>setPeriod(p)} style={{textTransform:"capitalize"}}>{p}</div>
          ))}
        </div>
        <div className="ptabs">
          {["heatmap","barbers","insights"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
          ))}
        </div>
      </div>

      <div className="sec screen" style={{marginTop:12,paddingBottom:80}}>
        {tab==="heatmap"&&(
          <>
            {/* KPI row */}
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              {[{l:"Avg Occupancy",v:`${avgOcc}%`,c:C.gold},{l:"Peak Day",v:peakDay,c:C.red},{l:"Peak Hour",v:peakHour,c:C.orange},{l:"Open Slots",v:"23%",c:C.green}].map(s=>(
                <div key={s.l} style={{flex:1,background:C.card,border:`1px solid ${s.c}25`,borderRadius:12,padding:"10px 4px",textAlign:"center"}}>
                  <p style={{fontSize:15,fontWeight:800,color:s.c}}>{s.v}</p>
                  <p style={{fontSize:8,color:C.muted,marginTop:2,lineHeight:1.3}}>{s.l}</p>
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="card" style={{marginBottom:14,overflowX:"auto"}}>
              <p className="stit" style={{marginBottom:12}}>Weekly Occupancy Heatmap</p>
              <div style={{minWidth:300}}>
                {/* Header row */}
                <div style={{display:"flex",gap:3,marginBottom:4}}>
                  <div style={{width:28,flexShrink:0}}/>
                  {OCC_DAYS.map(d=>(
                    <div key={d} style={{flex:1,textAlign:"center",fontSize:9,color:C.muted,fontWeight:700}}>{d}</div>
                  ))}
                </div>
                {OCC_HOURS.map((hour,hIdx)=>(
                  <div key={hour} style={{display:"flex",gap:3,marginBottom:3}}>
                    <div style={{width:28,flexShrink:0,fontSize:9,color:C.muted,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:4}}>{hour}</div>
                    {OCC_DAYS.map((day,dIdx)=>{
                      const val=OCC_MATRIX[dIdx][hIdx];
                      const isSelected=selCell&&selCell.day===dIdx&&selCell.hour===hIdx;
                      return(
                        <div key={day} className="occ-grid-cell" style={{flex:1,height:26,background:val===0?"rgba(255,255,255,.03)":cellColor(val),border:`1px solid ${isSelected?"rgba(201,168,76,.8)":"transparent"}`,color:cellTextColor(val)}}
                          onClick={()=>setSelCell(isSelected?null:{day:dIdx,hour:hIdx,val,dayLabel:day,hourLabel:hour})}>
                          {val>=50?val:null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div style={{marginTop:12,display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:10,color:C.muted,marginRight:4}}>Low</span>
                {[12,28,35,60,75,85].map((v,i)=>(
                  <div key={i} style={{width:20,height:12,borderRadius:3,background:cellColor(v)}}/>
                ))}
                <span style={{fontSize:10,color:C.muted,marginLeft:4}}>High</span>
              </div>
            </div>

            {/* Selected cell detail */}
            {selCell&&(
              <div style={{background:`${C.gold}10`,border:`1px solid ${C.gold}30`,borderRadius:14,padding:14,marginBottom:14}}>
                <p style={{fontSize:14,fontWeight:700,marginBottom:4}}>{selCell.dayLabel} at {selCell.hourLabel}</p>
                <div style={{display:"flex",gap:20}}>
                  <div><p style={{fontSize:22,fontWeight:900,color:selCell.val>=85?C.red:selCell.val>=70?C.orange:C.green}}>{selCell.val}%</p><p style={{fontSize:10,color:C.muted}}>Occupancy</p></div>
                  <div><p style={{fontSize:22,fontWeight:900,color:C.blue}}>{Math.round(selCell.val*3/100)}/{3}</p><p style={{fontSize:10,color:C.muted}}>Chairs booked</p></div>
                  <div><p style={{fontSize:22,fontWeight:900,color:C.purple}}>${Math.round(selCell.val*45/100)}</p><p style={{fontSize:10,color:C.muted}}>Est. revenue</p></div>
                </div>
              </div>
            )}

            {/* Opportunity callouts */}
            <div className="card">
              <p className="stit" style={{marginBottom:10}}>💡 Optimization Opportunities</p>
              {[
                {icon:"📉",txt:"Sunday afternoons are consistently under 25% — consider a promo or reduced hours.",color:C.blue},
                {icon:"🔥",txt:"Saturday is at 100% capacity — raise prices $5-10 to capture peak demand value.",color:C.red},
                {icon:"⚡",txt:"Tuesday evenings fill last-minute — send a day-of SMS to your waitlist.",color:C.orange},
              ].map((tip,i)=>(
                <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 0",borderBottom:i<2?`1px solid ${C.border}`:"none"}}>
                  <span style={{fontSize:18}}>{tip.icon}</span>
                  <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{tip.txt}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {tab==="barbers"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Utilization by Barber</p>
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              {BARBER_UTIL.map(b=>(
                <div key={b.name} className="util-card" style={{flex:1,borderColor:selBarber===b.name?`${b.color}60`:C.border,cursor:"pointer"}} onClick={()=>setSelBarber(selBarber===b.name?null:b.name)}>
                  <Gauge value={b.utilization} color={b.color}/>
                  <p style={{fontSize:13,fontWeight:700,marginTop:6,color:selBarber===b.name?b.color:C.text}}>{b.name}</p>
                </div>
              ))}
            </div>

            {BARBER_UTIL.map(b=>(
              <div key={b.name} className="card" style={{marginBottom:10,borderColor:selBarber===b.name?`${b.color}40`:C.border}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <p style={{fontSize:15,fontWeight:700}}>{b.name}</p>
                    <p style={{fontSize:12,color:C.muted}}>Peak: {b.peak} · Top: {b.topService}</p>
                  </div>
                  <span style={{fontSize:22,fontWeight:900,color:b.color}}>{b.utilization}%</span>
                </div>
                <div style={{height:8,background:C.surface,borderRadius:4,overflow:"hidden",marginBottom:10}}>
                  <div style={{height:"100%",width:`${b.utilization}%`,background:`linear-gradient(90deg,${b.color}66,${b.color})`,borderRadius:4,transition:"width .7s ease"}}/>
                </div>
                <div style={{display:"flex",gap:16}}>
                  <div><p style={{fontSize:14,fontWeight:700}}>{b.slotsUsed}/{b.totalSlots}</p><p style={{fontSize:10,color:C.muted}}>Slots used</p></div>
                  <div><p style={{fontSize:14,fontWeight:700,color:C.green}}>${Math.round(b.slotsUsed*42)}</p><p style={{fontSize:10,color:C.muted}}>Est. revenue</p></div>
                  <div><p style={{fontSize:14,fontWeight:700,color:b.utilization>=80?C.green:b.utilization>=60?C.orange:C.red}}>{b.utilization>=80?"Excellent":b.utilization>=60?"Good":"Needs Attention"}</p><p style={{fontSize:10,color:C.muted}}>Status</p></div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab==="insights"&&(
          <>
            <p className="stit" style={{marginBottom:10}}>Utilization Analytics</p>

            {/* Shop average gauge */}
            <div style={{background:C.card,border:`1px solid ${C.gold}25`,borderRadius:20,padding:20,marginBottom:16,display:"flex",gap:16,alignItems:"center"}}>
              <Gauge value={avgOcc} color={C.gold} size={90}/>
              <div>
                <p style={{fontSize:16,fontWeight:700}}>Shop Utilization</p>
                <p style={{fontSize:12,color:C.muted}}>Average across all barbers & hours</p>
                <p style={{fontSize:12,color:C.gold,fontWeight:700,marginTop:6}}>{avgOcc>=80?"High demand 🔥":avgOcc>=60?"Healthy 📈":"Growth opportunity 💡"}</p>
              </div>
            </div>

            {/* Day breakdown */}
            <div className="card" style={{marginBottom:12}}>
              <p className="stit" style={{marginBottom:12}}>Avg Occupancy by Day</p>
              {OCC_DAYS.map((day,i)=>{
                const avg=Math.round(OCC_MATRIX[i].reduce((a,b)=>a+b,0)/OCC_MATRIX[i].length);
                return(
                  <div key={day} style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600}}>{day}</span>
                      <span style={{fontSize:13,fontWeight:700,color:avg>=80?C.red:avg>=60?C.orange:C.green}}>{avg}%</span>
                    </div>
                    <div style={{height:7,background:C.surface,borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${avg}%`,background:avg>=80?`linear-gradient(90deg,${C.red}66,${C.red})`:avg>=60?`linear-gradient(90deg,${C.orange}66,${C.orange})`:`linear-gradient(90deg,${C.green}66,${C.green})`,borderRadius:3,transition:"width .7s ease"}}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Revenue lost to empty slots */}
            <div style={{background:`${C.red}08`,border:`1px solid ${C.red}25`,borderRadius:16,padding:16,marginBottom:12}}>
              <p style={{fontSize:14,fontWeight:700,marginBottom:8}}>💸 Revenue at Risk</p>
              {[{l:"Empty slots this week",v:"47 slots",sub:"Est. $2,115 unrealized"},{l:"No-show impact",v:"8 no-shows",sub:"Est. $360 lost"},{l:"Short-booking waste",v:"14 slots",sub:"Could add 30-min adds-on"}].map((row,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:i<2?`1px solid rgba(224,82,82,.15)`:"none"}}>
                  <div><p style={{fontSize:13,fontWeight:600}}>{row.l}</p><p style={{fontSize:11,color:C.muted}}>{row.sub}</p></div>
                  <span style={{fontSize:13,fontWeight:700,color:C.red}}>{row.v}</span>
                </div>
              ))}
            </div>

            <button className="btn bg" style={{width:"100%",padding:"13px"}} onClick={()=>showToast("Sharing optimization report...")}>📤 Share Insights Report</button>
          </>
        )}
      </div>
    </div>
  );
}

// ROOT APP — NAVIGATION STATE MACHINE
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// ════════════════════════════════════
// V15 – GOOGLE BUSINESS PROFILE
// ════════════════════════════════════
function GoogleBusinessScreen({onClose}){
  const [tab,setTab]=useState("overview");
  const [connected,setConnected]=useState(true);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const [editHours,setEditHours]=useState(false);
  const [postText,setPostText]=useState("");
  const [replyOpen,setReplyOpen]=useState(null);
  const [replyText,setReplyText]=useState("");

  const metrics=[
    {label:"Views (30d)",val:"1,284",icon:"👁",delta:"+18%",up:true},
    {label:"Searches",val:"342",icon:"🔍",delta:"+7%",up:true},
    {label:"Clicks",val:"96",icon:"🖱",delta:"-3%",up:false},
    {label:"Calls",val:"41",icon:"📞",delta:"+22%",up:true},
  ];
  const reviews=[
    {name:"Marcus J.",stars:5,date:"2d ago",text:"Freshest cuts in the city. Fades are clean every time!",replied:false},
    {name:"DeShawn W.",stars:5,date:"1w ago",text:"Best barbershop period. Been coming for 3 years.",replied:true,reply:"We appreciate you brother! See you next time ✂️"},
    {name:"Carlos M.",stars:4,date:"2w ago",text:"Great service, just wish booking was easier.",replied:false},
    {name:"Anon",stars:3,date:"3w ago",text:"Decent cut but waited 20 mins past appointment.",replied:false},
  ];
  const hours=[
    {day:"Mon",open:"9:00 AM",close:"7:00 PM",closed:false},
    {day:"Tue",open:"9:00 AM",close:"7:00 PM",closed:false},
    {day:"Wed",open:"9:00 AM",close:"7:00 PM",closed:false},
    {day:"Thu",open:"9:00 AM",close:"8:00 PM",closed:false},
    {day:"Fri",open:"9:00 AM",close:"8:00 PM",closed:false},
    {day:"Sat",open:"8:00 AM",close:"6:00 PM",closed:false},
    {day:"Sun",open:"10:00 AM",close:"4:00 PM",closed:false},
  ];

  return(
    <div className="modfull screen-enter">
      {toast&&<div className="toast">{toast}</div>}
      <div className="mhead">
        <button className="mback" onClick={onClose}>←</button>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>Google Business</h2>
        <div style={{width:32}}/>
      </div>

      {/* Connection status */}
      <div style={{padding:"0 20px"}}>
        <div className={connected?"gbp-status":"offline-banner"} style={{marginBottom:12}}>
          <span style={{fontSize:20}}>{connected?"✅":"⚠️"}</span>
          <div>
            <p style={{fontSize:13,fontWeight:700,color:connected?C.green:C.red}}>{connected?"Profile Connected":"Not Connected"}</p>
            <p style={{fontSize:11,color:C.muted}}>{connected?"Syncing: Fresh Cutz Barbershop · 4.8 ★":"Link your Google Business Profile"}</p>
          </div>
          {!connected&&<button className="btn btn-sm" onClick={()=>{setConnected(true);showToast("Profile linked!")}} style={{marginLeft:"auto",padding:"6px 12px",fontSize:11}}>Connect</button>}
        </div>

        <div className="ptabs" style={{marginBottom:16}}>
          {["overview","reviews","posts","hours"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"0 20px 100px"}}>
        {tab==="overview"&&<>
          <p style={{fontSize:12,color:C.muted,marginBottom:10}}>Last 30 days performance</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {metrics.map(m=>(
              <div key={m.label} className="gbp-metric">
                <div style={{fontSize:22,marginBottom:4}}>{m.icon}</div>
                <p style={{fontSize:22,fontWeight:800,fontFamily:"'Playfair Display',serif"}}>{m.val}</p>
                <p style={{fontSize:11,color:C.muted}}>{m.label}</p>
                <p style={{fontSize:11,fontWeight:600,color:m.up?C.green:C.red,marginTop:2}}>{m.delta} vs last month</p>
              </div>
            ))}
          </div>

          <div className="card" style={{padding:16,marginBottom:14}}>
            <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>⭐ Rating Overview</p>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12}}>
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:42,fontWeight:900,fontFamily:"'Playfair Display',serif",color:C.gold}}>4.8</p>
                <p style={{fontSize:11,color:C.muted}}>87 reviews</p>
              </div>
              <div style={{flex:1}}>
                {[5,4,3,2,1].map(s=>(
                  <div key={s} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <p style={{fontSize:11,width:10,color:C.muted}}>{s}</p>
                    <div className="comp-bar" style={{flex:1}}>
                      <div className="comp-bar-fill" style={{width:`${[72,18,6,2,2][5-s]}%`,background:s>=4?C.green:s===3?C.orange:C.red}}/>
                    </div>
                    <p style={{fontSize:10,color:C.dim,width:24}}>{[63,16,5,2,1][5-s]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{padding:16}}>
            <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>📸 Profile Photos</p>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>
              {["💈","✂️","🪒","🏪","🪑","➕"].map((ic,i)=>(
                <div key={i} className="gbp-photo-slot" onClick={()=>showToast(ic==="➕"?"Photo uploaded!":"Photo selected")}>
                  <span style={{fontSize:ic==="➕"?20:28}}>{ic}</span>
                </div>
              ))}
            </div>
            <p style={{fontSize:11,color:C.muted,marginTop:8}}>Listings with 10+ photos get 3× more clicks</p>
          </div>
        </>}

        {tab==="reviews"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <p style={{fontSize:13,color:C.muted}}>{reviews.length} recent reviews</p>
            <button className="bo" style={{padding:"6px 12px",fontSize:11}} onClick={()=>showToast("Reply templates ready!")}>Templates</button>
          </div>
          {reviews.map((r,i)=>(
            <div key={i} className="card" style={{padding:14,marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:36,height:36,borderRadius:12,background:`${C.gold}22`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:C.gold}}>{r.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <p style={{fontSize:14,fontWeight:600}}>{r.name}</p>
                    <p style={{fontSize:11,color:C.muted}}>{r.date}</p>
                  </div>
                  <div style={{display:"flex",gap:2}}>{Array.from({length:5},(_,j)=><span key={j} style={{fontSize:12,color:j<r.stars?"#F59E0B":C.border}}>★</span>)}</div>
                </div>
              </div>
              <p style={{fontSize:13,color:C.muted,marginBottom:8}}>{r.text}</p>
              {r.replied&&<div style={{background:C.surface,borderRadius:10,padding:10,borderLeft:`3px solid ${C.gold}`}}>
                <p style={{fontSize:11,color:C.gold,fontWeight:600,marginBottom:3}}>Your reply</p>
                <p style={{fontSize:12,color:C.muted}}>{r.reply}</p>
              </div>}
              {!r.replied&&(replyOpen===i?(
                <div>
                  <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Write your reply…" style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:10,color:C.text,fontSize:13,resize:"none",height:72,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <button className="btn" style={{flex:1,padding:"8px"}} onClick={()=>{showToast("Reply posted!");setReplyOpen(null);setReplyText("")}}>Post Reply</button>
                    <button className="bo" style={{padding:"8px 14px"}} onClick={()=>setReplyOpen(null)}>Cancel</button>
                  </div>
                </div>
              ):(
                <button className="bo" style={{padding:"6px 12px",fontSize:11}} onClick={()=>setReplyOpen(i)}>Reply</button>
              ))}
            </div>
          ))}
        </>}

        {tab==="posts"&&<>
          <div className="card" style={{padding:16,marginBottom:16}}>
            <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>📝 Create Google Post</p>
            <textarea value={postText} onChange={e=>setPostText(e.target.value)} placeholder="Share an update, offer, or event…" style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:12,color:C.text,fontSize:13,resize:"none",height:90,fontFamily:"'DM Sans',sans-serif",outline:"none",marginBottom:10}}/>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
              {["What's New","Offer","Event","COVID Update"].map(t=>(
                <span key={t} onClick={()=>setPostText(`[${t}] `)} style={{padding:"4px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,cursor:"pointer",color:C.muted}}>{t}</span>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn" style={{flex:1,padding:"10px"}} onClick={()=>{if(!postText.trim()){showToast("Write something first");return;}showToast("Post published to Google!");setPostText("")}}>Publish Post</button>
              <button className="bo" style={{padding:"10px 14px"}} onClick={()=>showToast("Scheduled for 9 AM tomorrow!")}>Schedule</button>
            </div>
          </div>
          <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>Recent Posts</p>
          {["🎉 Grand re-opening this Saturday — free shape-up with every haircut!","✂️ Summer special: Fade + Beard for $50 all month long."].map((p,i)=>(
            <div key={i} className="card" style={{padding:14,marginBottom:10}}>
              <p style={{fontSize:13,color:C.muted,marginBottom:8}}>{p}</p>
              <div style={{display:"flex",gap:10}}>
                <p style={{fontSize:11,color:C.dim}}>{i===0?"2d ago":"1w ago"}</p>
                <p style={{fontSize:11,color:C.blue}}>👁 {i===0?142:87} views</p>
                <p style={{fontSize:11,color:C.green}}>🖱 {i===0?18:9} clicks</p>
              </div>
            </div>
          ))}
        </>}

        {tab==="hours"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <p style={{fontSize:13,color:C.muted}}>Business hours</p>
            <button className="bo" style={{padding:"6px 12px",fontSize:11}} onClick={()=>setEditHours(!editHours)}>{editHours?"Done":"Edit"}</button>
          </div>
          {hours.map((h,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <p style={{fontSize:14,fontWeight:600,width:36}}>{h.day}</p>
              {editHours?(
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input defaultValue={h.open} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 8px",color:C.text,fontSize:12,width:80,outline:"none"}}/>
                  <span style={{color:C.muted,fontSize:11}}>–</span>
                  <input defaultValue={h.close} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 8px",color:C.text,fontSize:12,width:80,outline:"none"}}/>
                </div>
              ):(
                <p style={{fontSize:13,color:C.muted}}>{h.closed?"Closed":`${h.open} – ${h.close}`}</p>
              )}
            </div>
          ))}
          {editHours&&<button className="btn" style={{width:"100%",padding:12,marginTop:16}} onClick={()=>{setEditHours(false);showToast("Hours updated on Google!")}}>Save Hours</button>}
        </>}
      </div>
    </div>
  );
}

// ════════════════════════════════════
// V15 – COMPETITOR RATE COMPARISON
// ════════════════════════════════════
function CompetitorRateScreen({onClose}){
  const [tab,setTab]=useState("compare");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const [addOpen,setAddOpen]=useState(false);
  const [newName,setNewName]=useState("");

  const competitors=[
    {name:"The Fade Factory",dist:"0.4 mi",rating:4.6,reviews:134,avg:38,services:{Haircut:30,Fade:38,Beard:18,"Shape-Up":22,"Fade+Beard":50}},
    {name:"Kings Barber Lounge",dist:"0.8 mi",rating:4.7,reviews:210,avg:42,services:{Haircut:35,Fade:45,Beard:22,"Shape-Up":28,"Fade+Beard":60}},
    {name:"Classic Cuts",dist:"1.2 mi",rating:4.3,reviews:87,avg:30,services:{Haircut:25,Fade:32,Beard:15,"Shape-Up":20,"Fade+Beard":44}},
  ];
  const myPrices={Haircut:30,Fade:40,Beard:20,"Shape-Up":25,"Fade+Beard":55};
  const services=Object.keys(myPrices);

  const mktAvg=svc=>{
    const vals=competitors.map(c=>c.services[svc]||0).filter(Boolean);
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  };

  return(
    <div className="modfull screen-enter">
      {toast&&<div className="toast">{toast}</div>}
      <div className="mhead">
        <button className="mback" onClick={onClose}>←</button>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>Competitor Rates</h2>
        <button className="bo" style={{padding:"6px 10px",fontSize:11}} onClick={()=>setAddOpen(true)}>+ Add</button>
      </div>

      <div style={{padding:"0 20px"}}>
        <div className="ptabs" style={{marginBottom:0}}>
          {["compare","market","insights"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"16px 20px 100px"}}>
        {tab==="compare"&&<>
          {competitors.map((c,i)=>(
            <div key={i} className="comp-card">
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <p style={{fontSize:15,fontWeight:700}}>{c.name}</p>
                  <span style={{fontSize:11,color:C.muted}}>📍 {c.dist}</span>
                </div>
                <div style={{display:"flex",gap:12}}>
                  <p style={{fontSize:12,color:C.gold}}>★ {c.rating}</p>
                  <p style={{fontSize:12,color:C.muted}}>{c.reviews} reviews</p>
                  <p style={{fontSize:12,color:C.muted}}>avg ${c.avg}</p>
                </div>
              </div>
              {services.map(svc=>{
                const diff=myPrices[svc]-(c.services[svc]||myPrices[svc]);
                return(
                  <div key={svc} className="price-comparison-row">
                    <p style={{fontSize:12,flex:1,color:C.muted}}>{svc}</p>
                    <p style={{fontSize:12,color:C.muted,width:36,textAlign:"right"}}>${c.services[svc]||"–"}</p>
                    <p style={{fontSize:11,width:52,textAlign:"right",color:diff>0?C.green:diff<0?C.red:C.muted,fontWeight:diff!==0?700:400}}>{diff>0?`+$${diff} ↑`:diff<0?`-$${Math.abs(diff)} ↓`:"Equal"}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </>}

        {tab==="market"&&<>
          <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>Your Price vs Market Average</p>
          {services.map(svc=>{
            const avg=mktAvg(svc);
            const diff=myPrices[svc]-avg;
            const pct=Math.round((diff/avg)*100);
            return(
              <div key={svc} className="card" style={{padding:14,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <p style={{fontSize:14,fontWeight:600}}>{svc}</p>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:14,fontWeight:700,color:C.gold}}>${myPrices[svc]}</span>
                    <span style={{fontSize:11,color:C.muted}}> / avg ${avg}</span>
                  </div>
                </div>
                <div className="comp-bar">
                  <div className="comp-bar-fill" style={{width:`${Math.min(100,Math.round((myPrices[svc]/Math.max(...competitors.map(c=>c.services[svc]||0),myPrices[svc]))*100))}%`,background:diff>=0?C.green:C.orange}}/>
                </div>
                <p style={{fontSize:11,color:diff>=0?C.green:C.orange,marginTop:6,fontWeight:600}}>{diff>=0?`You charge $${diff} more (${pct}% above avg)`:`You charge $${Math.abs(diff)} less (${Math.abs(pct)}% below avg)`}</p>
              </div>
            );
          })}
        </>}

        {tab==="insights"&&<>
          <div className="card" style={{padding:16,marginBottom:12,borderLeft:`4px solid ${C.green}`}}>
            <p style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:6}}>💡 Price Opportunities</p>
            <p style={{fontSize:13,color:C.muted,marginBottom:8}}>Your <strong style={{color:C.text}}>Beard Trim</strong> at $20 is $2 below market avg. Consider raising to $22 — clients likely won't notice.</p>
            <button className="btn btn-sm" style={{padding:"6px 14px",fontSize:11}} onClick={()=>showToast("Service menu opened!")}>Update Price</button>
          </div>
          <div className="card" style={{padding:16,marginBottom:12,borderLeft:`4px solid ${C.gold}`}}>
            <p style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:6}}>📊 Competitive Position</p>
            <p style={{fontSize:13,color:C.muted}}>You're priced mid-market overall. Kings Barber Lounge charges 12% more — if your reviews are comparable, you have room to grow.</p>
          </div>
          <div className="card" style={{padding:16,borderLeft:`4px solid ${C.blue}`}}>
            <p style={{fontSize:13,fontWeight:700,color:C.blue,marginBottom:6}}>🏆 Your Advantages</p>
            {["Higher Google rating (4.8 vs avg 4.5)","Most reviews in your area","Best Fade + Beard value at $55"].map((a,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
                <span style={{color:C.green}}>✓</span>
                <p style={{fontSize:13,color:C.muted}}>{a}</p>
              </div>
            ))}
          </div>
        </>}
      </div>

      {addOpen&&(
        <div className="modfull" style={{background:"rgba(0,0,0,.85)",justifyContent:"flex-end"}}>
          <div style={{background:C.surface,borderRadius:"24px 24px 0 0",padding:24}}>
            <h3 style={{marginBottom:16}}>Add Competitor</h3>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Business name" style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",color:C.text,fontSize:14,outline:"none",marginBottom:10,fontFamily:"'DM Sans',sans-serif"}}/>
            <input placeholder="Address or Google Maps URL" style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",color:C.text,fontSize:14,outline:"none",marginBottom:16,fontFamily:"'DM Sans',sans-serif"}}/>
            <div style={{display:"flex",gap:10}}>
              <button className="btn" style={{flex:1,padding:12}} onClick={()=>{if(!newName){showToast("Enter a name");return;}showToast("Competitor added!");setAddOpen(false);setNewName("")}}>Add</button>
              <button className="bo" style={{padding:"12px 18px"}} onClick={()=>setAddOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════
// V15 – CLIENT WIN-BACK CAMPAIGNS
// ════════════════════════════════════
function WinBackScreen({onClose}){
  const [tab,setTab]=useState("campaigns");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const [selSeg,setSelSeg]=useState(null);
  const [launching,setLaunching]=useState(false);
  const [previewOpen,setPreviewOpen]=useState(null);

  const segments=[
    {id:"ghost",label:"Ghosts",desc:"No visit in 90+ days",icon:"👻",count:23,color:C.red},
    {id:"slipping",label:"Slipping Away",desc:"No visit in 60–89 days",icon:"⚠️",count:14,color:C.orange},
    {id:"inactive",label:"Inactive",desc:"No visit in 45–59 days",icon:"😴",count:31,color:C.blue},
    {id:"loyal",label:"Win-Back Loyal",desc:"Were regulars, now missing",icon:"💔",count:8,color:C.pink},
  ];
  const campaigns=[
    {name:"90-Day Ghost Blast",seg:"Ghosts",sent:23,opened:15,booked:4,revenue:180,status:"complete",date:"Feb 10"},
    {name:"60-Day Check-In",seg:"Slipping Away",sent:14,opened:11,booked:3,revenue:120,status:"complete",date:"Feb 17"},
    {name:"VIP Comeback Offer",seg:"Win-Back Loyal",sent:8,opened:7,booked:5,revenue:275,status:"active",date:"Feb 22"},
  ];
  const templates=[
    {name:"The Classic",msg:"Hey {name}! We miss you at Fresh Cutz. It's been a while — come back and get 20% off your next visit. Book now: {link}",emoji:"💈"},
    {name:"The VIP",msg:"Hi {name}, as one of our best clients, we saved you a special offer: free beard trim with your next haircut. Valid this week only. Book: {link}",emoji:"👑"},
    {name:"The Casual",msg:"Yo {name}! Long time no see 👋 Your barber misses your head lol. Come through this week — we'll make it worth it. {link}",emoji:"😄"},
    {name:"The Urgent",msg:"{name}, your usual slot is open this Friday. Don't let it go to someone else! Book before it fills up: {link}",emoji:"⚡"},
  ];

  const launch=()=>{
    if(!selSeg){showToast("Select a segment first");return;}
    setLaunching(true);
    setTimeout(()=>{setLaunching(false);showToast("Campaign launched! 📤");setTab("campaigns")},1800);
  };

  return(
    <div className="modfull screen-enter">
      {toast&&<div className="toast">{toast}</div>}
      <div className="mhead">
        <button className="mback" onClick={onClose}>←</button>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>Win-Back Campaigns</h2>
        <div style={{width:32}}/>
      </div>

      <div style={{padding:"0 20px 12px"}}>
        <div className="ptabs">
          {["campaigns","new","templates"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)}>{t==="new"?"+ New":t.charAt(0).toUpperCase()+t.slice(1)}</div>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"0 20px 100px"}}>
        {tab==="campaigns"&&<>
          {/* Summary stats */}
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[{label:"Total Sent",val:"45"},{label:"Booked Back",val:"12"},{label:"Revenue",val:"$575"}].map(s=>(
              <div key={s.label} className="wb-stat">
                <p style={{fontSize:20,fontWeight:800,fontFamily:"'Playfair Display',serif",color:C.gold}}>{s.val}</p>
                <p style={{fontSize:10,color:C.muted}}>{s.label}</p>
              </div>
            ))}
          </div>
          {campaigns.map((c,i)=>(
            <div key={i} className="card" style={{padding:14,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <p style={{fontSize:14,fontWeight:700}}>{c.name}</p>
                  <p style={{fontSize:11,color:C.muted}}>{c.seg} · {c.date}</p>
                </div>
                <span style={{padding:"3px 8px",borderRadius:8,fontSize:10,fontWeight:700,background:c.status==="active"?`${C.green}20`:`${C.muted}20`,color:c.status==="active"?C.green:C.muted}}>{c.status}</span>
              </div>
              <div style={{display:"flex",gap:16}}>
                <div style={{textAlign:"center"}}><p style={{fontSize:14,fontWeight:700}}>{c.sent}</p><p style={{fontSize:10,color:C.muted}}>Sent</p></div>
                <div style={{textAlign:"center"}}><p style={{fontSize:14,fontWeight:700,color:C.blue}}>{c.opened}</p><p style={{fontSize:10,color:C.muted}}>Opened</p></div>
                <div style={{textAlign:"center"}}><p style={{fontSize:14,fontWeight:700,color:C.green}}>{c.booked}</p><p style={{fontSize:10,color:C.muted}}>Booked</p></div>
                <div style={{textAlign:"center"}}><p style={{fontSize:14,fontWeight:700,color:C.gold}}>${c.revenue}</p><p style={{fontSize:10,color:C.muted}}>Revenue</p></div>
              </div>
            </div>
          ))}
        </>}

        {tab==="new"&&<>
          <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>1. Choose Segment</p>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {segments.map(s=>(
              <div key={s.id} className={`wb-seg${selSeg===s.id?" sel":""}`} onClick={()=>setSelSeg(s.id)}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:24}}>{s.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <p style={{fontSize:14,fontWeight:700}}>{s.label}</p>
                      <span style={{padding:"2px 8px",borderRadius:8,background:`${s.color}20`,color:s.color,fontSize:11,fontWeight:700}}>{s.count} clients</span>
                    </div>
                    <p style={{fontSize:12,color:C.muted}}>{s.desc}</p>
                  </div>
                  {selSeg===s.id&&<span style={{color:C.gold}}>✓</span>}
                </div>
              </div>
            ))}
          </div>

          <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>2. Choose Template</p>
          {templates.slice(0,2).map((t,i)=>(
            <div key={i} className="card" style={{padding:12,marginBottom:8,cursor:"pointer",border:previewOpen===i?`1px solid ${C.gold}`:`1px solid ${C.border}`}} onClick={()=>setPreviewOpen(previewOpen===i?null:i)}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:previewOpen===i?8:0}}>
                <span style={{fontSize:18}}>{t.emoji}</span>
                <p style={{fontSize:13,fontWeight:600}}>{t.name}</p>
                <span style={{marginLeft:"auto",fontSize:11,color:C.gold}}>{previewOpen===i?"▲":"▼"}</span>
              </div>
              {previewOpen===i&&<p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{t.msg}</p>}
            </div>
          ))}

          <p style={{fontSize:13,fontWeight:700,margin:"16px 0 10px"}}>3. Channel</p>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {["SMS","Email","Both"].map(ch=>(
              <div key={ch} className="link-type-chip sel" style={{flex:1,textAlign:"center",padding:"8px"}}>{ch}</div>
            ))}
          </div>

          <button className="btn" style={{width:"100%",padding:14,fontSize:15}} onClick={launch} disabled={launching}>
            {launching?"Launching campaign…":"🚀 Launch Campaign"}
          </button>
        </>}

        {tab==="templates"&&<>
          {templates.map((t,i)=>(
            <div key={i} className="card" style={{padding:14,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:22}}>{t.emoji}</span>
                <p style={{fontSize:14,fontWeight:700}}>{t.name}</p>
              </div>
              <p style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:10}}>{t.msg}</p>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-sm" style={{flex:1,padding:"7px"}} onClick={()=>showToast("Template copied!")}>Use Template</button>
                <button className="bo" style={{padding:"7px 12px"}} onClick={()=>showToast("Template duplicated!")}>Edit</button>
              </div>
            </div>
          ))}
          <button className="bo" style={{width:"100%",padding:12,marginTop:4}} onClick={()=>showToast("Custom template created!")}>+ Create Custom Template</button>
        </>}
      </div>
    </div>
  );
}

// ════════════════════════════════════
// V15 – DARK / LIGHT MODE TOGGLE
// ════════════════════════════════════
function DarkLightModeScreen({onClose}){
  const [theme,setTheme]=useState("dark");
  const [accent,setAccent]=useState("gold");
  const [fontSize,setFontSize]=useState("medium");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};

  const accents=[
    {id:"gold",color:"#C9A84C",label:"Gold"},
    {id:"blue",color:"#5B9CF6",label:"Ocean"},
    {id:"green",color:"#4CAF7A",label:"Forest"},
    {id:"purple",color:"#A78BFA",label:"Violet"},
    {id:"red",color:"#E05252",label:"Ruby"},
    {id:"orange",color:"#F59E0B",label:"Amber"},
  ];
  const themes=[
    {id:"dark",label:"Dark",bg:"#0D0D0D",surface:"#1E1E1E",text:"#F0EDE8"},
    {id:"light",label:"Light",bg:"#F5F5F0",surface:"#FFFFFF",text:"#1A1A1A"},
    {id:"midnight",label:"Midnight",bg:"#05050F",surface:"#12121F",text:"#E8E8FF"},
    {id:"warm",label:"Warm",bg:"#1A1208",surface:"#241A0A",text:"#F5EDD5"},
  ];

  return(
    <div className="modfull screen-enter">
      {toast&&<div className="toast">{toast}</div>}
      <div className="mhead">
        <button className="mback" onClick={onClose}>←</button>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>Appearance</h2>
        <div style={{width:32}}/>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"16px 20px 100px"}}>
        <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>🎨 Theme</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
          {themes.map(t=>(
            <div key={t.id} className={`theme-card${theme===t.id?" sel":""}`} onClick={()=>{setTheme(t.id);showToast(`${t.label} theme applied!`)}}>
              <div className="theme-preview" style={{background:t.bg,border:`1px solid #333`}}>
                <div style={{width:80,height:10,borderRadius:5,background:t.surface,marginBottom:4}}/>
                <div style={{width:60,height:8,borderRadius:4,background:`${accents.find(a=>a.id===accent)?.color||C.gold}88`}}/>
                <div style={{display:"flex",gap:4,marginTop:4}}>
                  <div style={{width:24,height:24,borderRadius:6,background:t.surface}}/>
                  <div style={{width:24,height:24,borderRadius:6,background:t.surface}}/>
                  <div style={{width:24,height:24,borderRadius:6,background:t.surface}}/>
                </div>
              </div>
              <p style={{fontSize:13,fontWeight:600}}>{t.label}</p>
              {theme===t.id&&<p style={{fontSize:11,color:C.gold}}>Active</p>}
            </div>
          ))}
        </div>

        <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>✨ Accent Color</p>
        <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
          {accents.map(a=>(
            <div key={a.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <div className={`accent-dot${accent===a.id?" sel":""}`} style={{background:a.color}} onClick={()=>{setAccent(a.id);showToast(`${a.label} accent set!`)}}/>
              <p style={{fontSize:10,color:C.muted}}>{a.label}</p>
            </div>
          ))}
        </div>

        <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>🔤 Text Size</p>
        <div style={{display:"flex",gap:8,marginBottom:24}}>
          {["small","medium","large"].map(s=>(
            <button key={s} className={fontSize===s?"btn":"bo"} style={{flex:1,padding:"10px",fontSize:s==="small"?11:s==="medium"?13:15}} onClick={()=>{setFontSize(s);showToast("Text size updated!")}}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
          ))}
        </div>

        <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>🌙 Auto Theme</p>
        <div className="card" style={{padding:14,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div>
              <p style={{fontSize:14,fontWeight:600}}>Follow System Theme</p>
              <p style={{fontSize:12,color:C.muted}}>Auto-switch with your phone's dark/light mode</p>
            </div>
            <Tog on={false} toggle={()=>showToast("System sync enabled!")}/>
          </div>
        </div>
        <div className="card" style={{padding:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <p style={{fontSize:14,fontWeight:600}}>Scheduled Theme</p>
              <p style={{fontSize:12,color:C.muted}}>Dark 8 PM – 7 AM, Light otherwise</p>
            </div>
            <Tog on={false} toggle={()=>showToast("Schedule enabled!")}/>
          </div>
        </div>

        <button className="btn" style={{width:"100%",padding:13,marginTop:20}} onClick={()=>showToast("Appearance saved!")}>Save Appearance</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════
// V15 – ONBOARDING TOUR / WALKTHROUGHS
// ════════════════════════════════════
function OnboardingTourScreen({onClose}){
  const [slide,setSlide]=useState(0);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const [tourMode,setTourMode]=useState(false);

  const slides=[
    {icon:"💈",color:C.gold,title:"Welcome to Chop-It-Up",sub:"Your all-in-one barbershop management platform",body:"Built by barbers, for barbers. Everything you need to run a world-class shop is right here."},
    {icon:"📅",color:C.blue,title:"Smart Appointments",sub:"Never double-book again",body:"Manage your calendar, add walk-ins, set recurring bookings, and send automatic reminders — all in seconds."},
    {icon:"💰",color:C.green,title:"Get Paid Faster",sub:"Stripe, Square, cash — all in one",body:"Accept any payment, split tips fairly, track expenses, and close out your day with one tap."},
    {icon:"📊",color:C.purple,title:"Know Your Numbers",sub:"Insights that grow your business",body:"Revenue forecasts, staff scorecards, occupancy rates, and client analytics — make data-driven decisions."},
    {icon:"📣",color:C.pink,title:"Grow Your Clientele",sub:"Marketing tools built in",body:"Google Business sync, win-back campaigns, loyalty rewards, and email blasts — all without leaving the app."},
    {icon:"🏆",color:C.gold,title:"You're Ready!",sub:"Let's build something great",body:"Your shop is set up and ready to go. Explore any feature from the dashboard, or take a guided tour of key screens."},
  ];

  const features=[
    {icon:"📅",label:"Appointments",desc:"Calendar, walk-ins, recurring",done:true},
    {icon:"💳",label:"Payments",desc:"Stripe setup & first charge",done:true},
    {icon:"👥",label:"Clients",desc:"Import or add your first client",done:false},
    {icon:"✂️",label:"Service Menu",desc:"Set your services & prices",done:false},
    {icon:"📸",label:"Portfolio",desc:"Add before/after photos",done:false},
    {icon:"📣",label:"Google Business",desc:"Link your profile",done:false},
  ];

  if(tourMode){
    const s=slides[slide];
    return(
      <div className="modfull screen-enter" style={{background:C.bg}}>
        {toast&&<div className="toast">{toast}</div>}
        <div className="tour-slide">
          <div className="tour-icon-bg" style={{background:`${s.color}22`,border:`1px solid ${s.color}44`}}>
            <span>{s.icon}</span>
          </div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,marginBottom:8}}>{s.title}</h2>
          <p style={{fontSize:14,color:C.gold,fontWeight:600,marginBottom:12}}>{s.sub}</p>
          <p style={{fontSize:14,color:C.muted,lineHeight:1.7,maxWidth:320}}>{s.body}</p>

          <div className="tour-dot-nav">
            {slides.map((_,i)=>(
              <div key={i} className={`tour-dot${slide===i?" act":""}`} onClick={()=>setSlide(i)}/>
            ))}
          </div>

          <div style={{display:"flex",gap:12,width:"100%",maxWidth:320}}>
            {slide>0&&<button className="bo" style={{flex:1,padding:13}} onClick={()=>setSlide(s=>s-1)}>Back</button>}
            {slide<slides.length-1?(
              <button className="btn" style={{flex:1,padding:13}} onClick={()=>setSlide(s=>s+1)}>Next →</button>
            ):(
              <button className="btn" style={{flex:1,padding:13}} onClick={()=>{setTourMode(false);showToast("Tour complete! 🎉")}}>Start Exploring</button>
            )}
          </div>
          {slide<slides.length-1&&<p style={{fontSize:12,color:C.dim,marginTop:16,cursor:"pointer"}} onClick={()=>{setTourMode(false);showToast("Tour skipped")}}>Skip tour</p>}
        </div>
      </div>
    );
  }

  return(
    <div className="modfull screen-enter">
      {toast&&<div className="toast">{toast}</div>}
      <div className="mhead">
        <button className="mback" onClick={onClose}>←</button>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>Setup & Walkthroughs</h2>
        <div style={{width:32}}/>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"16px 20px 100px"}}>
        <div className="card" style={{padding:20,marginBottom:20,textAlign:"center",background:`linear-gradient(135deg,rgba(201,168,76,.1),rgba(201,168,76,.03))`}}>
          <div style={{fontSize:48,marginBottom:12}}>🎓</div>
          <h3 style={{fontFamily:"'Playfair Display',serif",marginBottom:8}}>Interactive Tour</h3>
          <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Get a guided walkthrough of all key features. Takes about 2 minutes.</p>
          <button className="btn" style={{padding:"12px 32px"}} onClick={()=>setTourMode(true)}>Start Tour</button>
        </div>

        <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>📋 Setup Checklist</p>
        <div style={{marginBottom:20}}>
          {features.map((f,i)=>(
            <div key={i} className="feature-tour-pill" style={{borderColor:f.done?`${C.green}44`:C.border}}>
              <div style={{width:36,height:36,borderRadius:10,background:f.done?`${C.green}20`:`${C.card}`,border:`1px solid ${f.done?C.green:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{f.icon}</div>
              <div style={{flex:1}}>
                <p style={{fontSize:14,fontWeight:600,color:f.done?C.text:C.muted}}>{f.label}</p>
                <p style={{fontSize:11,color:C.dim}}>{f.desc}</p>
              </div>
              <span style={{fontSize:16,color:f.done?C.green:C.border}}>{f.done?"✓":"○"}</span>
            </div>
          ))}
        </div>
        <div style={{background:C.surface,borderRadius:12,padding:"12px 16px",marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <p style={{fontSize:13,fontWeight:600}}>Setup Progress</p>
            <p style={{fontSize:13,color:C.gold,fontWeight:700}}>2/6 complete</p>
          </div>
          <div className="comp-bar">
            <div className="comp-bar-fill" style={{width:"33%",background:C.gold}}/>
          </div>
        </div>

        <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>🎬 Feature Walkthroughs</p>
        {[
          {icon:"💳",title:"Accepting Your First Payment",dur:"1:20"},
          {icon:"📅",title:"Setting Up Recurring Bookings",dur:"2:05"},
          {icon:"📊",title:"Reading Your Analytics Dashboard",dur:"1:45"},
          {icon:"📣",title:"Running a Win-Back Campaign",dur:"2:30"},
        ].map((v,i)=>(
          <div key={i} className="card" style={{padding:14,marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>showToast("Walkthrough coming soon!")}>
            <div style={{width:44,height:44,borderRadius:12,background:`${C.gold}22`,border:`1px solid ${C.gold}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{v.icon}</div>
            <div style={{flex:1}}>
              <p style={{fontSize:13,fontWeight:600}}>{v.title}</p>
              <p style={{fontSize:11,color:C.muted}}>⏱ {v.dur}</p>
            </div>
            <span style={{fontSize:20,color:C.gold}}>▶</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════
// V15 – OFFLINE MODE INDICATOR
// ════════════════════════════════════
function OfflineModeScreen({onClose}){
  const [isOnline,setIsOnline]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const [tab,setTab]=useState("status");

  const pendingQueue=[
    {id:1,type:"Appointment",action:"Add",desc:"Marcus J. — Fade, 10:00 AM Fri",time:"5m ago",size:"1.2 KB"},
    {id:2,type:"Payment",action:"Record",desc:"$45 cash payment — DeShawn W.",time:"12m ago",size:"0.8 KB"},
    {id:3,type:"Client",action:"Update",desc:"Phone number update — Carlos M.",time:"1h ago",size:"0.4 KB"},
  ];
  const syncLog=[
    {label:"Appointments",icon:"📅",items:47,lastSync:"2 min ago",status:"ok"},
    {label:"Client Profiles",icon:"👥",items:183,lastSync:"2 min ago",status:"ok"},
    {label:"Payments",icon:"💳",items:312,lastSync:"2 min ago",status:"ok"},
    {label:"Inventory",icon:"📦",items:28,lastSync:"8 min ago",status:"ok"},
    {label:"Chat Messages",icon:"💬",items:94,lastSync:"Failed",status:"err"},
  ];
  const offlineCapable=[
    {label:"View appointments",available:true},
    {label:"Add walk-ins",available:true},
    {label:"Record cash payments",available:true},
    {label:"View client profiles",available:true},
    {label:"Accept card payments",available:false},
    {label:"Send SMS reminders",available:false},
    {label:"Sync Google Calendar",available:false},
    {label:"Load social posts",available:false},
  ];

  const doSync=()=>{
    setSyncing(true);
    setTimeout(()=>{setSyncing(false);showToast("All data synced! ✓")},1800);
  };

  return(
    <div className="modfull screen-enter">
      {toast&&<div className="toast">{toast}</div>}
      <div className="mhead">
        <button className="mback" onClick={onClose}>←</button>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>Offline Mode</h2>
        <button className="bo" style={{padding:"6px 10px",fontSize:11}} onClick={doSync}>{syncing?"Syncing…":"Sync"}</button>
      </div>

      <div style={{padding:"0 20px 12px"}}>
        <div className={isOnline?"online-banner":"offline-banner"}>
          <div className={isOnline?"sync-pulse":""}style={{width:10,height:10,borderRadius:"50%",background:isOnline?C.green:C.red,flexShrink:0}}/>
          <div style={{flex:1}}>
            <p style={{fontSize:13,fontWeight:700,color:isOnline?C.green:C.red}}>{isOnline?"Connected — Live Sync Active":"Offline — Local Mode"}</p>
            <p style={{fontSize:11,color:C.muted}}>{isOnline?"All changes sync in real-time":"Changes saved locally, will sync when reconnected"}</p>
          </div>
          <button className="bo" style={{padding:"5px 10px",fontSize:11,flexShrink:0}} onClick={()=>setIsOnline(v=>!v)}>Simulate</button>
        </div>
        <div className="ptabs" style={{marginBottom:0}}>
          {["status","queue","capabilities"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"16px 20px 100px"}}>
        {tab==="status"&&<>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[{label:"Pending",val:pendingQueue.length,color:C.orange},{label:"Synced Today",val:"47",color:C.green},{label:"Last Sync",val:"2m ago",color:C.blue}].map(s=>(
              <div key={s.label} className="wb-stat">
                <p style={{fontSize:18,fontWeight:800,fontFamily:"'Playfair Display',serif",color:s.color}}>{s.val}</p>
                <p style={{fontSize:10,color:C.muted}}>{s.label}</p>
              </div>
            ))}
          </div>
          <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>Sync Status</p>
          {syncLog.map((s,i)=>(
            <div key={i} className="sync-item">
              <span style={{fontSize:22}}>{s.icon}</span>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:600}}>{s.label}</p>
                <p style={{fontSize:11,color:C.muted}}>{s.items} records · Last: {s.lastSync}</p>
              </div>
              <span style={{fontSize:16,color:s.status==="ok"?C.green:C.red}}>{s.status==="ok"?"✓":"⚠"}</span>
            </div>
          ))}
          <div className="card" style={{padding:14,marginTop:16}}>
            <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>💾 Local Storage</p>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <p style={{fontSize:12,color:C.muted}}>Used</p>
              <p style={{fontSize:12,fontWeight:600}}>12.4 MB</p>
            </div>
            <div className="comp-bar" style={{marginBottom:8}}>
              <div className="comp-bar-fill" style={{width:"31%",background:C.blue}}/>
            </div>
            <p style={{fontSize:11,color:C.muted}}>12.4 MB used of 40 MB local cache</p>
            <button className="bo" style={{width:"100%",padding:10,marginTop:10,fontSize:12}} onClick={()=>showToast("Cache cleared!")}>Clear Cache</button>
          </div>
        </>}

        {tab==="queue"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <p style={{fontSize:13,color:C.muted}}>{pendingQueue.length} changes pending sync</p>
            <button className="btn btn-sm" style={{padding:"6px 12px",fontSize:11}} onClick={doSync}>{syncing?"…":"Sync All"}</button>
          </div>
          {pendingQueue.map(q=>(
            <div key={q.id} className="offline-queue-item">
              <div style={{width:36,height:36,borderRadius:10,background:`${C.orange}20`,border:`1px solid ${C.orange}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                {q.type==="Appointment"?"📅":q.type==="Payment"?"💳":"👤"}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{padding:"2px 6px",background:`${C.orange}20`,color:C.orange,borderRadius:6,fontSize:10,fontWeight:700}}>{q.action}</span>
                  <p style={{fontSize:12,fontWeight:600}}>{q.type}</p>
                </div>
                <p style={{fontSize:11,color:C.muted}}>{q.desc}</p>
                <p style={{fontSize:10,color:C.dim}}>{q.time} · {q.size}</p>
              </div>
            </div>
          ))}
          {!isOnline&&<div className="offline-banner" style={{marginTop:12}}>
            <span>📡</span>
            <p style={{fontSize:12,color:C.red}}>Changes queued — will sync automatically when reconnected</p>
          </div>}
        </>}

        {tab==="capabilities"&&<>
          <p style={{fontSize:13,color:C.muted,marginBottom:14}}>Features available without internet connection</p>
          <div className="card" style={{padding:14,marginBottom:12,borderLeft:`3px solid ${C.green}`}}>
            <p style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:8}}>✅ Available Offline</p>
            {offlineCapable.filter(f=>f.available).map((f,i)=>(
              <div key={i} style={{display:"flex",gap:8,padding:"5px 0"}}>
                <span style={{color:C.green,fontSize:13}}>✓</span>
                <p style={{fontSize:13,color:C.muted}}>{f.label}</p>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:14,borderLeft:`3px solid ${C.red}`}}>
            <p style={{fontSize:12,fontWeight:700,color:C.red,marginBottom:8}}>⚠️ Requires Connection</p>
            {offlineCapable.filter(f=>!f.available).map((f,i)=>(
              <div key={i} style={{display:"flex",gap:8,padding:"5px 0"}}>
                <span style={{color:C.dim,fontSize:13}}>○</span>
                <p style={{fontSize:13,color:C.dim}}>{f.label}</p>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

// ════════════════════════════════════
// V15 – PUSH NOTIFICATION DEEP LINKS
// ════════════════════════════════════
function PushDeepLinksScreen({onClose}){
  const [tab,setTab]=useState("builder");
  const [toast,setToast]=useState("");
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(""),2400)};
  const [linkType,setLinkType]=useState("appointment");
  const [sending,setSending]=useState(false);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");

  const linkTypes=[
    {id:"appointment",label:"Appointment",icon:"📅",dest:"Opens appointment detail"},
    {id:"payment",label:"Payment",icon:"💳",dest:"Opens payment screen"},
    {id:"review",label:"Review Request",icon:"⭐",dest:"Opens review form"},
    {id:"booking",label:"Booking",icon:"🔗",dest:"Opens booking flow"},
    {id:"offer",label:"Special Offer",icon:"🎁",dest:"Opens promo screen"},
    {id:"chat",label:"New Message",icon:"💬",dest:"Opens chat thread"},
  ];
  const recentLinks=[
    {title:"Appointment Reminder",body:"Marcus, your 10 AM fade is tomorrow!",type:"appointment",sent:234,opened:201,tapped:167,rate:83},
    {title:"New Review Request",body:"How was your visit? Tap to leave a quick review ⭐",type:"review",sent:89,opened:71,tapped:48,rate:67},
    {title:"Flash Special",body:"Today only: $5 off any haircut 🪒 Book now!",type:"offer",sent:312,opened:189,tapped:94,rate:49},
  ];
  const templates=[
    {title:"Appointment Reminder",body:"{name}, your {service} is tomorrow at {time}. Tap to confirm or reschedule.",type:"appointment"},
    {title:"New Message",body:"Your barber sent you a message. Tap to read it.",type:"chat"},
    {title:"Loyalty Milestone",body:"🏆 {name}, you just hit {points} points! Tap to see your reward.",type:"booking"},
    {title:"Re-engagement",body:"It's been a while, {name}! Your barber misses you. Book your spot.",type:"booking"},
  ];

  const sendNotif=()=>{
    if(!title||!body){showToast("Fill in title and message");return;}
    setSending(true);
    setTimeout(()=>{setSending(false);showToast("Push sent to 183 clients! 📱");setTitle("");setBody("")},1800);
  };

  const selType=linkTypes.find(l=>l.id===linkType);

  return(
    <div className="modfull screen-enter">
      {toast&&<div className="toast">{toast}</div>}
      <div className="mhead">
        <button className="mback" onClick={onClose}>←</button>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>Push Notifications</h2>
        <div style={{width:32}}/>
      </div>

      <div style={{padding:"0 20px 12px"}}>
        <div className="ptabs">
          {["builder","history","templates"].map(t=>(
            <div key={t} className={`ptab${tab===t?" act":""}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"0 20px 100px"}}>
        {tab==="builder"&&<>
          {/* Live Preview */}
          <p style={{fontSize:12,color:C.muted,marginBottom:8}}>Live Preview</p>
          <div className="notif-preview" style={{marginBottom:16}}>
            <div className="notif-preview-header">
              <div className="notif-app-icon">✂</div>
              <p style={{fontSize:12,color:"#9999BB",flex:1}}>Chop-It-Up</p>
              <p style={{fontSize:11,color:"#666"}}>now</p>
            </div>
            <p style={{fontSize:14,fontWeight:700,color:"#E8E8FF",marginBottom:3}}>{title||"Notification Title"}</p>
            <p style={{fontSize:12,color:"#9999BB",lineHeight:1.4}}>{body||"Your notification message will appear here…"}</p>
            {selType&&<div style={{marginTop:8,padding:"5px 10px",background:"rgba(255,255,255,.06)",borderRadius:8,display:"inline-flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12}}>{selType.icon}</span>
              <p style={{fontSize:11,color:"#9999BB"}}>→ {selType.dest}</p>
            </div>}
          </div>

          <div style={{marginBottom:14}}>
            <p style={{fontSize:12,color:C.muted,marginBottom:6}}>Title</p>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Notification title…" style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:14,outline:"none",fontFamily:"'DM Sans',sans-serif"}}/>
          </div>
          <div style={{marginBottom:16}}>
            <p style={{fontSize:12,color:C.muted,marginBottom:6}}>Message</p>
            <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your message…" style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:14,outline:"none",fontFamily:"'DM Sans',sans-serif",resize:"none",height:72}}/>
          </div>

          <p style={{fontSize:12,color:C.muted,marginBottom:8}}>Deep Link Destination</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
            {linkTypes.map(l=>(
              <div key={l.id} className={`link-type-chip${linkType===l.id?" sel":""}`} onClick={()=>setLinkType(l.id)}>
                {l.icon} {l.label}
              </div>
            ))}
          </div>

          <p style={{fontSize:12,color:C.muted,marginBottom:8}}>Send To</p>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {["All Clients","Active (30d)","Inactive","Custom"].map((a,i)=>(
              <div key={a} className={`link-type-chip${i===0?" sel":""}`}>{a}</div>
            ))}
          </div>

          <button className="btn" style={{width:"100%",padding:13,fontSize:15}} onClick={sendNotif} disabled={sending}>
            {sending?"Sending…":"📱 Send Push Notification"}
          </button>
        </>}

        {tab==="history"&&<>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[{l:"Sent",v:"635"},{l:"Open Rate",v:"72%"},{l:"Tap Rate",v:"56%"}].map(s=>(
              <div key={s.l} className="wb-stat">
                <p style={{fontSize:18,fontWeight:800,fontFamily:"'Playfair Display',serif",color:C.gold}}>{s.v}</p>
                <p style={{fontSize:10,color:C.muted}}>{s.l}</p>
              </div>
            ))}
          </div>
          {recentLinks.map((n,i)=>(
            <div key={i} className="deep-link-card">
              <div style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:8}}>
                <span style={{fontSize:22}}>{linkTypes.find(l=>l.id===n.type)?.icon||"🔔"}</span>
                <div style={{flex:1}}>
                  <p style={{fontSize:14,fontWeight:600}}>{n.title}</p>
                  <p style={{fontSize:12,color:C.muted}}>{n.body}</p>
                </div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <div style={{textAlign:"center"}}><p style={{fontSize:13,fontWeight:700}}>{n.sent}</p><p style={{fontSize:10,color:C.muted}}>Sent</p></div>
                <div style={{textAlign:"center"}}><p style={{fontSize:13,fontWeight:700,color:C.blue}}>{n.opened}</p><p style={{fontSize:10,color:C.muted}}>Opened</p></div>
                <div style={{textAlign:"center"}}><p style={{fontSize:13,fontWeight:700,color:C.green}}>{n.tapped}</p><p style={{fontSize:10,color:C.muted}}>Tapped</p></div>
                <div style={{textAlign:"center"}}><p style={{fontSize:13,fontWeight:700,color:C.gold}}>{n.rate}%</p><p style={{fontSize:10,color:C.muted}}>Tap Rate</p></div>
              </div>
            </div>
          ))}
        </>}

        {tab==="templates"&&<>
          {templates.map((t,i)=>(
            <div key={i} className="card" style={{padding:14,marginBottom:10}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:18}}>{linkTypes.find(l=>l.id===t.type)?.icon||"🔔"}</span>
                <p style={{fontSize:14,fontWeight:600}}>{t.title}</p>
              </div>
              <p style={{fontSize:12,color:C.muted,lineHeight:1.5,marginBottom:10}}>{t.body}</p>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-sm" style={{flex:1,padding:"7px"}} onClick={()=>{setTitle(t.title);setBody(t.body);setLinkType(t.type);setTab("builder");showToast("Template loaded!");}}>Use</button>
                <button className="bo" style={{padding:"7px 12px"}} onClick={()=>showToast("Duplicated to custom!")}>Duplicate</button>
              </div>
            </div>
          ))}
          <button className="bo" style={{width:"100%",padding:12,marginTop:4}} onClick={()=>showToast("Custom template created!")}>+ Create Template</button>
        </>}
      </div>
    </div>
  );
}

export default function App(){
  // App flow: splash → auth → onboarding → main
  const [appState,setAppState]=useState("splash"); // splash | auth | onboarding | main
  const [userData,setUserData]=useState({shopName:"Fresh Cutz",barberName:"Marcus Johnson",role:"barber"});

  // On splash done: check if already logged in via Parse session token
  const handleSplashDone=useCallback(async()=>{
    const current=ParseService.currentUser();
    if(current){
      try{
        await current.fetch(); // re-validate session with server
        const profile=await ParseService.getShopProfile();
        if(profile) setUserData(profile);
        setAppState("main");
      } catch(e){
        // Session expired or invalid — go to auth
        setAppState("auth");
      }
    } else {
      setAppState("auth");
    }
  },[]);
  const [tab,setTab]=useState("home");
  const [addOpen,setAddOpen]=useState(false);
  const [adminOpen,setAdminOpen]=useState(false);
  const [bookingOpen,setBookingOpen]=useState(false);
  const [waitlistOpen,setWaitlistOpen]=useState(false);
  const [noShowOpen,setNoShowOpen]=useState(false);
  const [notifsOpen,setNotifsOpen]=useState(false);
  const [clientAppOpen,setClientAppOpen]=useState(false);
  const [inventoryOpen,setInventoryOpen]=useState(false);
  const [socialOpen,setSocialOpen]=useState(false);
  const [multiBarberOpen,setMultiBarberOpen]=useState(false);
  const [calendarOpen,setCalendarOpen]=useState(false);
  const [reviewsOpen,setReviewsOpen]=useState(false);
  const [stripeOpen,setStripeOpen]=useState(false);
  const [bookingPolishOpen,setBookingPolishOpen]=useState(false);
  const [serviceMenuOpen,setServiceMenuOpen]=useState(false);
  const [referralOpen,setReferralOpen]=useState(false);
  const [forecastingOpen,setForecastingOpen]=useState(false);
  const [cashOutOpen,setCashOutOpen]=useState(false);
  const [walkInOpen,setWalkInOpen]=useState(false);
  const [portfolioOpen,setPortfolioOpen]=useState(false);
  const [payrollOpen,setPayrollOpen]=useState(false);
  const [tipSplitOpen,setTipSplitOpen]=useState(false);
  const [taxExpenseOpen,setTaxExpenseOpen]=useState(false);
  const [supplyOpen,setSupplyOpen]=useState(false);
  const [checkInOpen,setCheckInOpen]=useState(false);
  const [recurringOpen,setRecurringOpen]=useState(false);
  const [equipmentOpen,setEquipmentOpen]=useState(false);
  const [timeClockOpen,setTimeClockOpen]=useState(false);
  const [chatOpen,setChatOpen]=useState(false);
  const [depositOpen,setDepositOpen]=useState(false);
  const [briefingOpen,setBriefingOpen]=useState(false);
  const [scorecardsOpen,setScorecardsOpen]=useState(false);
  const [emailCampOpen,setEmailCampOpen]=useState(false);
  const [dataExportOpen,setDataExportOpen]=useState(false);
  const [franchiseOpen,setFranchiseOpen]=useState(false);
  const [refundOpen,setRefundOpen]=useState(false);
  const [qrOpen,setQrOpen]=useState(false);
  const [reportBuilderOpen,setReportBuilderOpen]=useState(false);
  const [loyaltyWalletOpen,setLoyaltyWalletOpen]=useState(false);
  const [appLockOpen,setAppLockOpen]=useState(false);
  const [consultOpen,setConsultOpen]=useState(false);
  const [bdayOpen,setBdayOpen]=useState(false);
  const [baRequestOpen,setBaRequestOpen]=useState(false);
  const [chairRentalOpen,setChairRentalOpen]=useState(false);
  const [waitingRoomOpen,setWaitingRoomOpen]=useState(false);
  const [breakSchedOpen,setBreakSchedOpen]=useState(false);
  const [achPayoutsOpen,setAchPayoutsOpen]=useState(false);
  const [priceOverrideOpen,setPriceOverrideOpen]=useState(false);
  const [revByServiceOpen,setRevByServiceOpen]=useState(false);
  const [occupancyOpen,setOccupancyOpen]=useState(false);
  // V15
  const [googleBizOpen,setGoogleBizOpen]=useState(false);
  const [competitorOpen,setCompetitorOpen]=useState(false);
  const [winBackOpen,setWinBackOpen]=useState(false);
  const [darkLightOpen,setDarkLightOpen]=useState(false);
  const [onboardingTourOpen,setOnboardingTourOpen]=useState(false);
  const [offlineModeOpen,setOfflineModeOpen]=useState(false);
  const [pushDeepLinksOpen,setPushDeepLinksOpen]=useState(false);
  const [moreTab,setMoreTab]=useState(null);

  const NAV=[
    {id:"home",icon:"🏠",lbl:"Home"},
    {id:"appts",icon:"📅",lbl:"Appts"},
    {id:"clients",icon:"👥",lbl:"Clients"},
    {id:"pay",icon:"💰",lbl:"Pay"},
    {id:"more",icon:"⚡",lbl:"More"},
  ];

  const handleAuth=async(role)=>{
    setUserData(u=>({...u,role}));
    // New users (just signed up) go to onboarding; existing users go straight to main
    const current=ParseService.currentUser();
    const isNew = current && !current.get("shopName");
    if(isNew){
      setAppState("onboarding");
    } else {
      const profile=await ParseService.getShopProfile();
      if(profile) setUserData(profile);
      setAppState("main");
    }
  };

  const handleOnboardDone=async(info)=>{
    if(info){
      setUserData(u=>({...u,...info}));
      try{ await ParseService.saveShopProfile(info); } catch(e){}
    }
    setAppState("main");
  };

  // ── SPLASH ──
  if(appState==="splash") return(
    <>
      <style>{CSS}</style>
      <div className="app">
        <SplashScreen onDone={handleSplashDone}/>
      </div>
    </>
  );

  // ── AUTH ──
  if(appState==="auth") return(
    <>
      <style>{CSS}</style>
      <div className="app">
        <AuthScreen onAuth={handleAuth}/>
      </div>
    </>
  );

  // ── ONBOARDING ──
  if(appState==="onboarding") return(
    <>
      <style>{CSS}</style>
      <div className="app">
        <OnboardingScreen onDone={handleOnboardDone}/>
      </div>
    </>
  );

  // ── MAIN APP ──
  return(
    <>
      <style>{`${CSS}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div className="app">
        {/* Status bar with notification bell */}
        <div style={{padding:"12px 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:13,fontWeight:600}}>9:41 AM</span>
          <span className="pf" style={{fontSize:15,fontWeight:700,color:C.gold,letterSpacing:.5}}>✂️ Chop-It-Up v15</span>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div className="notif-bell" onClick={()=>setNotifsOpen(true)}>
              <span style={{fontSize:18}}>🔔</span>
              <div className="notif-count">3</div>
            </div>
            <span style={{fontSize:12}}>🔋</span>
          </div>
        </div>

        {/* Screens */}
        {tab==="home"&&<Dashboard onAdd={()=>setAddOpen(true)} onAdmin={()=>setAdminOpen(true)} onBookingPage={()=>setBookingOpen(true)} onWaitlist={()=>setWaitlistOpen(true)} onNoShow={()=>setNoShowOpen(true)} shopName={userData.shopName}/>}
        {tab==="appts"&&<Appointments onAdd={()=>setAddOpen(true)} onWaitlist={()=>setWaitlistOpen(true)} onNoShow={()=>setNoShowOpen(true)}/>}
        {tab==="clients"&&<ClientsScreen/>}
        {tab==="pay"&&<Payments/>}
        {tab==="more"&&!moreTab&&(
          <div className="screen screen-enter">
            <div className="hdr"><h2 className="pf" style={{fontSize:24,fontWeight:700,marginBottom:4}}>More</h2><p style={{fontSize:13,color:C.muted}}>Tools & features</p></div>
            <div className="sec" style={{marginBottom:20}}>
              {[
                {icon:"📋",label:"Waitlist",sub:"Queue management & auto-notify",color:C.blue,t:"waitlist",badge:WAITLIST_INIT.length},
                {icon:"🚫",label:"No-Show Management",sub:"Fees, blocking, at-risk clients",color:C.red,t:"noshow",dot:true},
                {icon:"🔔",label:"Notifications",sub:"Alerts, push settings, digest",color:C.purple,t:"notifs",badge:3},
                {icon:"👤",label:"Client App View",sub:"Preview the client experience",color:C.gold,t:"clientapp",new:true},
                {icon:"📦",label:"Inventory",sub:"Products, stock levels, sales",color:C.green,t:"inventory"},
                {icon:"📱",label:"Social Posting",sub:"AI captions, scheduling, analytics",color:C.pink,t:"social",new:true},
                {icon:"💼",label:"Shop Management",sub:"Multi-barber, chairs, revenue split",color:C.purple,t:"multibarber"},
                {icon:"📅",label:"Calendar View",sub:"Weekly schedule, drag-to-reschedule",color:C.blue,t:"calendar",new:true},
                {icon:"⭐",label:"Reviews & Ratings",sub:"Collect, respond, and display reviews",color:C.gold,t:"reviews",new:true},
                {icon:"💳",label:"Stripe Payments",sub:"Reader setup, payouts, bank linking",color:"#635BFF",t:"stripe",new:true},
                {icon:"🔗",label:"Booking Flow",sub:"Confirmations, SMS threads, reminders",color:C.green,t:"bookingpolish",new:true},
                {icon:"✂️",label:"Service Menu",sub:"Build your menu, set prices & durations",color:C.gold,t:"servicemenu",new:true},
                {icon:"🎁",label:"Referral Program",sub:"Refer-a-friend rewards & tracking",color:C.pink,t:"referral",new:true},
                {icon:"🤖",label:"AI Forecasting",sub:"Revenue forecast, goals & AI insights",color:C.purple,t:"forecasting",new:true},
                {icon:"💵",label:"Cash-Out / EOD",sub:"Daily close-out & cash reconciliation",color:C.green,t:"cashout",new:true},
                {icon:"📟",label:"Walk-In Queue",sub:"Kiosk check-in & queue management",color:C.blue,t:"walkin",new:true},
                {icon:"📸",label:"Photo Portfolio",sub:"Before/after gallery per barber",color:C.orange,t:"portfolio",new:true},
                {icon:"💬",label:"Messages",sub:"Client ↔ barber chat threads",color:C.blue,t:"chat",new:true},
                {icon:"💳",label:"Deposits & Prepay",sub:"Require deposits, track payments",color:C.green,t:"deposits",new:true},
                {icon:"☀️",label:"Daily Briefing",sub:"Morning report & action items",color:C.gold,t:"briefing",new:true},
                {icon:"📊",label:"Staff Scorecards",sub:"Per-barber KPIs & performance",color:C.purple,t:"scorecards",new:true},
                {icon:"📧",label:"Email Campaigns",sub:"Build & send marketing emails",color:C.pink,t:"emailcamp",new:true},
                {icon:"📤",label:"Data Export",sub:"Export clients, revenue, appointments",color:C.blue,t:"dataexport",new:true},
                {icon:"💼",label:"Payroll & Commission",sub:"Pay stubs, splits, history",color:C.gold,t:"payroll",new:true},
                {icon:"💸",label:"Tip Splitting",sub:"Pool, individual, or custom splits",color:C.green,t:"tipsplit",new:true},
                {icon:"🧾",label:"Tax & Expenses",sub:"Deductions, quarterly estimates, mileage",color:C.red,t:"taxexpense",new:true},
                {icon:"📦",label:"Supply Reorder",sub:"Stock levels, purchase orders, vendors",color:C.blue,t:"supply",new:true},
                {icon:"✅",label:"Client Check-In",sub:"Consultation form & arrival flow",color:C.green,t:"checkin",new:true},
                {icon:"🔄",label:"Recurring Appointments",sub:"Manage all repeat bookings",color:C.purple,t:"recurring",new:true},
                {icon:"🔧",label:"Equipment Maintenance",sub:"Clippers, chairs, service logs",color:C.orange,t:"equipment",new:true},
                {icon:"⏰",label:"Time Clock",sub:"Clock in/out, shifts, hours summary",color:C.blue,t:"timeclock",new:true},
                {icon:"🏢",label:"Franchise HQ",sub:"Multi-location network dashboard",color:C.gold,t:"franchise",new:true},
                {icon:"💸",label:"Refund Center",sub:"Approve, deny & track refunds",color:C.red,t:"refund",new:true},
                {icon:"📱",label:"QR Generator",sub:"Booking, check-in & tip QR codes",color:C.green,t:"qr",new:true},
                {icon:"📊",label:"Report Builder",sub:"Custom analytics & exports",color:C.purple,t:"reportbuilder",new:true},
                {icon:"🏆",label:"Loyalty Wallet",sub:"Client points, rewards & history",color:C.gold,t:"loyaltywallet",new:true},
                {icon:"🔐",label:"App Lock & PIN",sub:"PIN & biometric app security",color:C.blue,t:"applock",new:true},
                {icon:"📋",label:"Consultation Forms",sub:"Pre-appointment client intake",color:C.gold,t:"consult",new:true},
                {icon:"🎂",label:"Birthday Automation",sub:"Auto birthday & anniversary messages",color:C.pink,t:"bday",new:true},
                {icon:"📸",label:"Style Requests",sub:"Before/after reference photo flow",color:C.purple,t:"barequest",new:true},
                {icon:"🪑",label:"Chair Rentals",sub:"Booth renter tracking & rent collection",color:C.green,t:"chairrental",new:true},
                {icon:"🖥",label:"Waiting Room Display",sub:"TV queue board for your waiting area",color:C.blue,t:"waitingroom",new:true},
                {icon:"☕",label:"Break Scheduler",sub:"Barber breaks, lunch & coverage",color:C.orange,t:"breaksched",new:true},
                {icon:"🏦",label:"ACH Bank Payouts",sub:"Direct bank transfers & payout history",color:C.green,t:"achpayouts",new:true},
                {icon:"🏷",label:"Price Overrides",sub:"Discount approvals with manager PIN",color:C.orange,t:"priceoverride",new:true},
                {icon:"📊",label:"Revenue by Service",sub:"Earnings breakdown per service type",color:C.blue,t:"revbyservice",new:true},
                {icon:"📈",label:"Occupancy & Utilization",sub:"Chair fill rate, heatmap & efficiency",color:C.purple,t:"occupancy",new:true},
                {icon:"📍",label:"Google Business",sub:"Profile, reviews, posts & insights",color:C.green,t:"googlebiz",new:true},
                {icon:"🏷",label:"Competitor Rates",sub:"Compare your pricing vs nearby shops",color:C.blue,t:"competitor",new:true},
                {icon:"💌",label:"Win-Back Campaigns",sub:"Re-engage lost & inactive clients",color:C.pink,t:"winback",new:true},
                {icon:"🎨",label:"Appearance",sub:"Dark/light mode, accent colors",color:C.purple,t:"darklight",new:true},
                {icon:"🎓",label:"Setup & Walkthroughs",sub:"Tour features & track setup progress",color:C.gold,t:"onboardingtour",new:true},
                {icon:"📡",label:"Offline Mode",sub:"Sync status, queue & offline features",color:C.orange,t:"offlinemode",new:true},
                {icon:"🔔",label:"Push Notifications",sub:"Deep links, templates & send history",color:C.blue,t:"pushdeeplinks",new:true},
                {icon:"📊",label:"Analytics & Growth",sub:"Revenue, clients, insights",color:C.blue,t:"analytics"},
                {icon:"🏆",label:"Loyalty Rewards",sub:"Tiers, points, activity",color:C.gold,t:"loyalty"},
                {icon:"🎁",label:"Gift Cards & Promos",sub:"Create cards, manage promo codes",color:C.pink,t:"gifts"},
                {icon:"📣",label:"Marketing",sub:"SMS blasts, social posts",color:C.green,t:"marketing"},
                {icon:"⚙️",label:"Profile & Settings",sub:"Account, services, billing",color:C.muted,t:"profile"},
              ].map(item=>(
                <div key={item.t} onClick={()=>{
                  if(item.t==="waitlist") setWaitlistOpen(true);
                  else if(item.t==="noshow") setNoShowOpen(true);
                  else if(item.t==="notifs") setNotifsOpen(true);
                  else if(item.t==="clientapp") setClientAppOpen(true);
                  else if(item.t==="inventory") setInventoryOpen(true);
                  else if(item.t==="social") setSocialOpen(true);
                  else if(item.t==="multibarber") setMultiBarberOpen(true);
                  else if(item.t==="calendar") setCalendarOpen(true);
                  else if(item.t==="reviews") setReviewsOpen(true);
                  else if(item.t==="stripe") setStripeOpen(true);
                  else if(item.t==="bookingpolish") setBookingPolishOpen(true);
                  else if(item.t==="servicemenu") setServiceMenuOpen(true);
                  else if(item.t==="referral") setReferralOpen(true);
                  else if(item.t==="forecasting") setForecastingOpen(true);
                  else if(item.t==="cashout") setCashOutOpen(true);
                  else if(item.t==="walkin") setWalkInOpen(true);
                  else if(item.t==="portfolio") setPortfolioOpen(true);
                  else if(item.t==="chat") setChatOpen(true);
                  else if(item.t==="deposits") setDepositOpen(true);
                  else if(item.t==="briefing") setBriefingOpen(true);
                  else if(item.t==="scorecards") setScorecardsOpen(true);
                  else if(item.t==="emailcamp") setEmailCampOpen(true);
                  else if(item.t==="dataexport") setDataExportOpen(true);
                  else if(item.t==="payroll") setPayrollOpen(true);
                  else if(item.t==="tipsplit") setTipSplitOpen(true);
                  else if(item.t==="taxexpense") setTaxExpenseOpen(true);
                  else if(item.t==="supply") setSupplyOpen(true);
                  else if(item.t==="checkin") setCheckInOpen(true);
                  else if(item.t==="recurring") setRecurringOpen(true);
                  else if(item.t==="equipment") setEquipmentOpen(true);
                  else if(item.t==="timeclock") setTimeClockOpen(true);
                  else if(item.t==="franchise") setFranchiseOpen(true);
                  else if(item.t==="refund") setRefundOpen(true);
                  else if(item.t==="qr") setQrOpen(true);
                  else if(item.t==="reportbuilder") setReportBuilderOpen(true);
                  else if(item.t==="loyaltywallet") setLoyaltyWalletOpen(true);
                  else if(item.t==="applock") setAppLockOpen(true);
                  else if(item.t==="consult") setConsultOpen(true);
                  else if(item.t==="bday") setBdayOpen(true);
                  else if(item.t==="barequest") setBaRequestOpen(true);
                  else if(item.t==="chairrental") setChairRentalOpen(true);
                  else if(item.t==="waitingroom") setWaitingRoomOpen(true);
                  else if(item.t==="breaksched") setBreakSchedOpen(true);
                  else if(item.t==="achpayouts") setAchPayoutsOpen(true);
                  else if(item.t==="priceoverride") setPriceOverrideOpen(true);
                  else if(item.t==="revbyservice") setRevByServiceOpen(true);
                  else if(item.t==="occupancy") setOccupancyOpen(true);
                  else if(item.t==="googlebiz") setGoogleBizOpen(true);
                  else if(item.t==="competitor") setCompetitorOpen(true);
                  else if(item.t==="winback") setWinBackOpen(true);
                  else if(item.t==="darklight") setDarkLightOpen(true);
                  else if(item.t==="onboardingtour") setOnboardingTourOpen(true);
                  else if(item.t==="offlinemode") setOfflineModeOpen(true);
                  else if(item.t==="pushdeeplinks") setPushDeepLinksOpen(true);
                  else setMoreTab(item.t);
                }} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
                  <div style={{width:46,height:46,borderRadius:14,background:`${item.color}18`,border:`1px solid ${item.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,position:"relative"}}>
                    {item.icon}
                    {item.badge&&<div style={{position:"absolute",top:-5,right:-5,width:18,height:18,background:item.t==="notifs"?C.red:C.blue,borderRadius:"50%",fontSize:9,fontWeight:700,color:"white",display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${C.bg}`}}>{item.badge}</div>}
                    {item.dot&&<div style={{position:"absolute",top:-3,right:-3,width:10,height:10,background:C.red,borderRadius:"50%",border:`2px solid ${C.bg}`}}/>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <p style={{fontSize:15,fontWeight:600}}>{item.label}</p>
                      {item.new&&<span className="badge bblu" style={{fontSize:9,padding:"1px 6px"}}>NEW</span>}
                    </div>
                    <p style={{fontSize:12,color:C.muted}}>{item.sub}</p>
                  </div>
                  <span style={{color:C.dim,fontSize:18}}>›</span>
                </div>
              ))}
              <div onClick={()=>setBookingOpen(true)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",cursor:"pointer"}}>
                <div style={{width:46,height:46,borderRadius:14,background:`${C.blue}18`,border:`1px solid ${C.blue}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🔗</div>
                <div style={{flex:1}}><p style={{fontSize:15,fontWeight:600}}>Client Booking Page</p><p style={{fontSize:12,color:C.muted}}>Preview your public booking experience</p></div>
                <span className="badge bblu" style={{fontSize:10}}>LIVE</span>
              </div>
            </div>
          </div>
        )}
        {tab==="more"&&moreTab==="analytics"&&<><AnalyticsScreen/><div style={{padding:"0 20px 20px"}}><button className="bo" style={{width:"100%",padding:"12px"}} onClick={()=>setMoreTab(null)}>← Back</button></div></>}
        {tab==="more"&&moreTab==="loyalty"&&<><LoyaltyScreen/><div style={{padding:"0 20px 20px"}}><button className="bo" style={{width:"100%",padding:"12px"}} onClick={()=>setMoreTab(null)}>← Back</button></div></>}
        {tab==="more"&&moreTab==="gifts"&&<GiftCardsScreen onBack={()=>setMoreTab(null)}/>}
        {tab==="more"&&moreTab==="marketing"&&<Marketing onBack={()=>setMoreTab(null)}/>}
        {tab==="more"&&moreTab==="profile"&&<Profile onAdmin={()=>setAdminOpen(true)} onBack={()=>setMoreTab(null)} onSignOut={async()=>{try{await ParseService.logOut();}catch(e){}setAppState("auth");setTab("home");setMoreTab(null);}} userData={userData}/>}

        {tab==="appts"&&<button className="fab" onClick={()=>setAddOpen(true)}>+</button>}

        {/* Bottom nav */}
        <nav className="nav">
          {NAV.map(n=>(
            <div key={n.id} className={`ni${tab===n.id?" act":""}`} onClick={()=>{setTab(n.id);if(n.id!=="more")setMoreTab(null);}} style={{color:tab===n.id?C.gold:C.dim}}>
              <div className="nicon">{n.icon}</div>
              <div className="nlbl">{n.lbl}</div>
            </div>
          ))}
        </nav>

        {/* All modals/overlays */}
        {addOpen&&<AddAppt onClose={()=>setAddOpen(false)}/>}
        {adminOpen&&<AdminDashboard onClose={()=>setAdminOpen(false)}/>}
        {bookingOpen&&<ClientBookingPage onClose={()=>setBookingOpen(false)}/>}
        {waitlistOpen&&<WaitlistScreen onClose={()=>setWaitlistOpen(false)}/>}
        {noShowOpen&&<NoShowScreen onClose={()=>setNoShowOpen(false)}/>}
        {notifsOpen&&<NotificationsCenter onClose={()=>setNotifsOpen(false)}/>}
        {clientAppOpen&&<ClientAppView onClose={()=>setClientAppOpen(false)}/>}
        {inventoryOpen&&<InventoryScreen onClose={()=>setInventoryOpen(false)}/>}
        {socialOpen&&<SocialScreen onClose={()=>setSocialOpen(false)}/>}
        {multiBarberOpen&&<MultiBarberScreen onClose={()=>setMultiBarberOpen(false)}/>}
        {calendarOpen&&<CalendarScreen onClose={()=>setCalendarOpen(false)}/>}
        {reviewsOpen&&<ReviewsScreen onClose={()=>setReviewsOpen(false)}/>}
        {stripeOpen&&<StripePaymentsScreen onClose={()=>setStripeOpen(false)}/>}
        {bookingPolishOpen&&<BookingFlowPolished onClose={()=>setBookingPolishOpen(false)}/>}
        {serviceMenuOpen&&<ServiceMenuScreen onClose={()=>setServiceMenuOpen(false)}/>}
        {referralOpen&&<ReferralScreen onClose={()=>setReferralOpen(false)}/>}
        {forecastingOpen&&<ForecastingScreen onClose={()=>setForecastingOpen(false)}/>}
        {cashOutOpen&&<CashOutScreen onClose={()=>setCashOutOpen(false)}/>}
        {walkInOpen&&<WalkInKioskScreen onClose={()=>setWalkInOpen(false)}/>}
        {portfolioOpen&&<PortfolioScreen onClose={()=>setPortfolioOpen(false)}/>}
        {chatOpen&&<InAppChatScreen onClose={()=>setChatOpen(false)}/>}
        {depositOpen&&<DepositScreen onClose={()=>setDepositOpen(false)}/>}
        {briefingOpen&&<DailyBriefingScreen onClose={()=>setBriefingOpen(false)}/>}
        {scorecardsOpen&&<StaffScorecardsScreen onClose={()=>setScorecardsOpen(false)}/>}
        {emailCampOpen&&<EmailCampaignScreen onClose={()=>setEmailCampOpen(false)}/>}
        {dataExportOpen&&<DataExportScreen onClose={()=>setDataExportOpen(false)}/>}
        {payrollOpen&&<PayrollScreen onClose={()=>setPayrollOpen(false)}/>}
        {tipSplitOpen&&<TipSplittingScreen onClose={()=>setTipSplitOpen(false)}/>}
        {taxExpenseOpen&&<TaxExpenseScreen onClose={()=>setTaxExpenseOpen(false)}/>}
        {supplyOpen&&<SupplyReorderScreen onClose={()=>setSupplyOpen(false)}/>}
        {checkInOpen&&<ClientCheckInScreen onClose={()=>setCheckInOpen(false)}/>}
        {recurringOpen&&<RecurringApptScreen onClose={()=>setRecurringOpen(false)}/>}
        {equipmentOpen&&<EquipmentScreen onClose={()=>setEquipmentOpen(false)}/>}
        {timeClockOpen&&<TimeClockScreen onClose={()=>setTimeClockOpen(false)}/>}
        {franchiseOpen&&<FranchiseScreen onClose={()=>setFranchiseOpen(false)}/>}
        {refundOpen&&<RefundScreen onClose={()=>setRefundOpen(false)}/>}
        {qrOpen&&<QRCodeScreen onClose={()=>setQrOpen(false)}/>}
        {reportBuilderOpen&&<ReportBuilderScreen onClose={()=>setReportBuilderOpen(false)}/>}
        {loyaltyWalletOpen&&<LoyaltyWalletScreen onClose={()=>setLoyaltyWalletOpen(false)}/>}
        {appLockOpen&&<AppLockScreen onClose={()=>setAppLockOpen(false)}/>}
        {consultOpen&&<ConsultationFormsScreen onClose={()=>setConsultOpen(false)}/>}
        {bdayOpen&&<BirthdayAutomationScreen onClose={()=>setBdayOpen(false)}/>}
        {baRequestOpen&&<BeforeAfterRequestScreen onClose={()=>setBaRequestOpen(false)}/>}
        {chairRentalOpen&&<ChairRentalScreen onClose={()=>setChairRentalOpen(false)}/>}
        {waitingRoomOpen&&<WaitingRoomScreen onClose={()=>setWaitingRoomOpen(false)}/>}
        {breakSchedOpen&&<BreakSchedulerScreen onClose={()=>setBreakSchedOpen(false)}/>}
        {achPayoutsOpen&&<ACHPayoutsScreen onClose={()=>setAchPayoutsOpen(false)}/>}
        {priceOverrideOpen&&<PriceOverrideScreen onClose={()=>setPriceOverrideOpen(false)}/>}
        {revByServiceOpen&&<RevenueByServiceScreen onClose={()=>setRevByServiceOpen(false)}/>}
        {occupancyOpen&&<OccupancyScreen onClose={()=>setOccupancyOpen(false)}/>}
        {googleBizOpen&&<GoogleBusinessScreen onClose={()=>setGoogleBizOpen(false)}/>}
        {competitorOpen&&<CompetitorRateScreen onClose={()=>setCompetitorOpen(false)}/>}
        {winBackOpen&&<WinBackScreen onClose={()=>setWinBackOpen(false)}/>}
        {darkLightOpen&&<DarkLightModeScreen onClose={()=>setDarkLightOpen(false)}/>}
        {onboardingTourOpen&&<OnboardingTourScreen onClose={()=>setOnboardingTourOpen(false)}/>}
        {offlineModeOpen&&<OfflineModeScreen onClose={()=>setOfflineModeOpen(false)}/>}
        {pushDeepLinksOpen&&<PushDeepLinksScreen onClose={()=>setPushDeepLinksOpen(false)}/>}
      </div>
    </>
  );
}
