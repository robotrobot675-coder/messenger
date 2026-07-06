const socket = io();
let username = "";
let googlePic = "";
let googleName = "";
let typingTimer = null;
let windowFocused = !document.hidden;

function reqNotif() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
        try { new Notification("💬 Notifications active", { body: "You will get alerts for new messages" }); } catch(e) {}
        return;
    }
    if (Notification.permission === "default") {
        Notification.requestPermission().then(p => {
            if (p === "granted") try { new Notification("💬 Notifications active", { body: "You will get alerts for new messages" }); } catch(e) {}
        });
    }
}

document.addEventListener("visibilitychange", () => { windowFocused = !document.hidden; });
window.addEventListener("focus", () => { windowFocused = true; });
window.addEventListener("blur", () => { windowFocused = false; });
let particleSystem = null;
let particleScene = null;
let particleMaterial = null;

const emojis = ["😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","🥰","😘","🤗","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","😴","😌","😛","😜","😝","🤤","😒","😓","😔","😕","🙃","🫤","😲","☹️","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩","🤯","😬","😰","😱","🥵","🥶","😳","🤪","😵","😡","😠","🤬","👋","🤚","🖐","✋","🖖","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👍","👎","👊","✊","🤛","🤜","👏","🙌","🤲","🤝","🙏","💪","🔥","💯","⭐","🌟","✨","💥","❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💗","💖","💘","💝","🎉","🎊","🎈","🎁","💎","👑","🎶","🎵","🌈","☀️","🌙","⭐","⚡","🌊","🍕","🍔","🌮","🍩","☕","🍺","🍻","🥂","🎂","🍰","🚀","💻","📱","🎮","📷","🎤","🎧","🏆","🥇","🥈","🥉"];

const themes = {
    cyberpunk: { label: "Cyberpunk", hue: [0.65, 0.85], colors: ["#6366f1","#a855f7","#f472b6"] },
    neon:      { label: "Neon",      hue: [0.45, 0.55], colors: ["#22d3ee","#10b981","#facc15"] },
    ocean:     { label: "Ocean",     hue: [0.50, 0.65], colors: ["#38bdf8","#2dd4bf","#60a5fa"] },
    romantic:  { label: "Romantic",  hue: [0.92, 0.98], colors: ["#ff69b4","#ff1493","#ffb6c1"] },
    midnight:  { label: "Midnight",  hue: [0.60, 0.75], colors: ["#7c3aed","#3b82f6","#8b5cf6"] },
    forest:    { label: "Forest",    hue: [0.30, 0.45], colors: ["#22c55e","#059669","#84cc16"] },
    sunset:    { label: "Sunset",    hue: [0.00, 0.10], colors: ["#f97316","#e11d48","#f59e0b"] },
    light:     { label: "Light",     hue: [0.65, 0.75], colors: ["#6366f1","#a855f7","#f472b6"] },
    naruko:    { label: "Naruko",    hue: [0.45, 0.55], colors: ["#a1fcf7","#6bc5be","#ffffff"] },
};

function setTheme(name) {
    document.documentElement.setAttribute("data-theme", name);
    localStorage.setItem("chat-theme", name);
    apply3DTheme(name);
    const font = name === "naruko" ? "" : "'Inter', system-ui, sans-serif";
    document.body.style.fontFamily = font;
    document.querySelectorAll("button, input, textarea").forEach(el => {
        el.style.fontFamily = font;
    });
    document.querySelectorAll(".theme-dot").forEach(d => {
        d.classList.toggle("active", d.dataset.theme === name);
    });
}

/* Reset stale localStorage theme from previous versions */
(function(){ const v = localStorage.getItem("chat-theme-version"); if (v !== "2") { localStorage.removeItem("chat-theme"); localStorage.setItem("chat-theme-version", "2"); } })();

function initThemeSwitcher() {
    const grid = document.getElementById("theme-grid");
    const htmlDefault = document.documentElement.getAttribute("data-theme") || "naruko";
    const saved = localStorage.getItem("chat-theme") || htmlDefault;
    Object.entries(themes).forEach(([key, t]) => {
        const dot = document.createElement("div");
        dot.className = "theme-dot" + (key === saved ? " active" : "");
        dot.dataset.theme = key;
        dot.style.background = `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`;
        dot.title = t.label;
        dot.onclick = () => setTheme(key);
        grid.appendChild(dot);
    });
    setTheme(saved);
}

const themeBgs = {
    naruko:    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920&q=80",
    cyberpunk: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920&q=80",
    neon:      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1920&q=80",
    ocean:     "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80",
    romantic:  "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=1920&q=80",
    midnight:  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80",
    forest:    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80",
    sunset:    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
    light:     "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=80",
};

const theme3D = {
    naruko: { count: 1500, layout: "cloud", move: "drift", size: [0.03,0.09], opacity: 0.65, hue: [0.42,0.52], speed: 0.0002, mouseInfluence: 0.025, sat: [0.3,0.6], light: [0.5,0.8] },
    cyberpunk: { count: 2500, layout: "grid", move: "pulse", size: [0.02,0.06], opacity: 0.9, hue: [0.65,0.85], speed: 0.0008, mouseInfluence: 0.05, sat: [0.7,1.0], light: [0.4,0.7] },
    neon: { count: 1800, layout: "rings", move: "orbit", size: [0.03,0.1], opacity: 0.85, hue: [0.45,0.55], speed: 0.0006, mouseInfluence: 0.04, sat: [0.6,1.0], light: [0.5,0.8] },
    ocean: { count: 2000, layout: "sphere", move: "wave", size: [0.025,0.07], opacity: 0.75, hue: [0.50,0.65], speed: 0.0004, mouseInfluence: 0.03, sat: [0.5,0.8], light: [0.4,0.7] },
    romantic: { count: 1800, layout: "sphere", move: "pulse", size: [0.03,0.12], opacity: 0.85, hue: [0.92,0.98], speed: 0.0005, mouseInfluence: 0.04, sat: [0.7,1.0], light: [0.5,0.9] },
    midnight: { count: 800, layout: "sphere", move: "twinkle", size: [0.05,0.18], opacity: 1.0, hue: [0.6,0.75], speed: 0.0001, mouseInfluence: 0.015, sat: [0.6,0.9], light: [0.5,0.9] },
    forest: { count: 1000, layout: "column", move: "fall", size: [0.03,0.1], opacity: 0.8, hue: [0.25,0.40], speed: 0.0002, mouseInfluence: 0.02, sat: [0.5,0.8], light: [0.3,0.6] },
    sunset: { count: 1000, layout: "sphere", move: "rise", size: [0.03,0.14], opacity: 0.9, hue: [0.00,0.12], speed: 0.0005, mouseInfluence: 0.04, sat: [0.7,1.0], light: [0.5,0.9] },
    light: { count: 500, layout: "spiral", move: "drift", size: [0.015,0.04], opacity: 0.35, hue: [0.0,0.0], speed: 0.0003, mouseInfluence: 0.01, sat: [0.0,0.0], light: [0.7,0.95] },
};

let particlePositions = null;
let particleBasePos = null;
let particleSizesArr = null;
let twinklePhases = null;
let renderer = null;
let camera = null;
let mouse = { x: 0, y: 0 };
let currentTheme3D = "naruko";
let clock = 0;
let showingChatPhoto = false;

function buildParticles(cfg) {
    const geo = new THREE.BufferGeometry();
    const count = cfg.count;
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    particleBasePos = new Float32Array(count * 3);
    twinklePhases = new Float32Array(count);
    const [hMin, hMax] = cfg.hue;
    const [sMin, sMax] = cfg.sat;
    const [lMin, lMax] = cfg.light;
    const [sizeMin, sizeMax] = cfg.size;
    for (let i = 0; i < count; i++) {
        let x, y, z; const i3 = i * 3;
        if (cfg.layout === "grid") { const cols = Math.ceil(Math.sqrt(count)); const gx = (i%cols)/cols-0.5; const gy = Math.floor(i/cols)/cols-0.5; x = gx*8+(Math.random()-0.5)*0.3; y = gy*6+(Math.random()-0.5)*0.3; z = (Math.random()-0.5)*4; }
        else if (cfg.layout === "rings") { const ring = Math.floor(i/200); const angle = (i%200)/200*Math.PI*2; const r = 2+ring*1.5; x = Math.cos(angle)*r; z = Math.sin(angle)*r; y = (Math.random()-0.5)*8; }
        else if (cfg.layout === "cloud") { const radius = 2+Math.random()*6; const theta = Math.random()*Math.PI*2; const phi = Math.random()*Math.PI; x = Math.sin(phi)*Math.cos(theta)*radius; y = Math.sin(phi)*Math.sin(theta)*radius*0.7; z = Math.cos(phi)*radius*0.6; }
        else if (cfg.layout === "column") { x = (Math.random()-0.5)*6; y = (Math.random()-0.5)*14; z = (Math.random()-0.5)*6; }
        else if (cfg.layout === "spiral") { const t = i/count; const angle = t*Math.PI*6; const r = t*7; x = Math.cos(angle)*r; z = Math.sin(angle)*r; y = (t-0.5)*12; }
        else { x = (Math.random()-0.5)*18; y = (Math.random()-0.5)*14; z = (Math.random()-0.5)*14; }
        pos[i3] = x; pos[i3+1] = y; pos[i3+2] = z;
        particleBasePos[i3] = x; particleBasePos[i3+1] = y; particleBasePos[i3+2] = z;
        const c = new THREE.Color();
        if (cfg.hue[0] === cfg.hue[1] && cfg.hue[0] === 0) { const g = 0.6+Math.random()*0.3; c.setRGB(g,g,g); }
        else { c.setHSL(hMin+Math.random()*(hMax-hMin), sMin+Math.random()*(sMax-sMin), lMin+Math.random()*(lMax-lMin)); }
        colors[i3] = c.r; colors[i3+1] = c.g; colors[i3+2] = c.b;
        sizes[i] = sizeMin+Math.random()*(sizeMax-sizeMin);
        twinklePhases[i] = Math.random()*Math.PI*2;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    particlePositions = pos; particleSizesArr = sizes;
    const mat = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: cfg.opacity, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    return { system: new THREE.Points(geo, mat), material: mat, geometry: geo };
}

function init3D() {
    const canvas = document.getElementById("bg-canvas");
    const scene = new THREE.Scene();
    particleScene = scene;
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const htmlDefault = document.documentElement.getAttribute("data-theme") || "naruko";
    const saved = localStorage.getItem("chat-theme") || htmlDefault;
    apply3DTheme(saved);
    camera.position.z = 6;

    document.addEventListener("mousemove", (e) => { mouse.x = (e.clientX/window.innerWidth)*2-1; mouse.y = -(e.clientY/window.innerHeight)*2+1; });

    function animate() {
        requestAnimationFrame(animate);
        clock += 0.01;
        if (particleSystem && !showingChatPhoto) {
            const cfg = theme3D[currentTheme3D] || theme3D.naruko;
            particleSystem.rotation.y = clock * cfg.speed * 10;
            particleSystem.rotation.x = Math.sin(clock * cfg.speed * 3) * 0.03;
            const pos = particlePositions, base = particleBasePos;
            if (pos && base) {
                const count = pos.length / 3;
                if (cfg.move === "wave") { for (let i=0; i<count; i++) { const i3=i*3; pos[i3+1]=base[i3+1]+Math.sin(clock*2+base[i3]*2)*0.5; pos[i3]=base[i3]+Math.cos(clock*1.5+base[i3+2]*1.5)*0.3; } }
                else if (cfg.move === "pulse") { const p=1+Math.sin(clock*3)*0.1; for (let i=0; i<count; i++) { const i3=i*3; pos[i3]=base[i3]*p; pos[i3+1]=base[i3+1]*p; pos[i3+2]=base[i3+2]*p; } }
                else if (cfg.move === "orbit") { for (let i=0; i<count; i++) { const i3=i*3; const r=Math.sqrt(base[i3]*base[i3]+base[i3+2]*base[i3+2]); const a=Math.atan2(base[i3+2],base[i3])+clock*0.5*(1+base[i3+1]*0.05); pos[i3]=Math.cos(a)*r; pos[i3+2]=Math.sin(a)*r; pos[i3+1]=base[i3+1]+Math.sin(clock+i*0.01)*0.2; } }
                else if (cfg.move === "twinkle") { for (let i=0; i<count; i++) { const i3=i*3; pos[i3]=base[i3]; pos[i3+1]=base[i3+1]; pos[i3+2]=base[i3+2]; particleSizesArr[i]=(cfg.size[0]+(cfg.size[1]-cfg.size[0])*(i%100)/100)*(0.3+0.7*(0.5+0.5*Math.sin(clock*2+twinklePhases[i]))); } particleSystem.geometry.attributes.size.needsUpdate=true; }
                else if (cfg.move === "fall") { for (let i=0; i<count; i++) { const i3=i*3; const d=currentTheme3D==="forest"?0.1:0.3; pos[i3]=base[i3]+Math.sin(clock+base[i3+2])*d; pos[i3+1]=base[i3+1]-(clock*0.08)%14+(clock*0.08)%1; pos[i3+2]=currentTheme3D==="forest"?base[i3+2]:base[i3+2]+Math.cos(clock+base[i3])*0.2; } }
                else if (cfg.move === "rise") { for (let i=0; i<count; i++) { const i3=i*3; pos[i3]=base[i3]+Math.sin(clock*0.5+base[i3+2])*0.2; pos[i3+1]=((base[i3+1]+clock*0.15)%14)-7; pos[i3+2]=base[i3+2]; } }
                particleSystem.geometry.attributes.position.needsUpdate = true;
            }
            camera.position.x += (mouse.x * cfg.mouseInfluence - camera.position.x) * 0.02;
            camera.position.y += (mouse.y * cfg.mouseInfluence * 0.6 - camera.position.y) * 0.02;
            camera.lookAt(0, 0, 0);
        }
        for (let ei = chatEffects.length - 1; ei >= 0; ei--) {
            const g = chatEffects[ei], d = g.userData;
            d.age += 0.016;
            const p = d.age / d.dur;
            if (p >= 1) {
                particleScene.remove(g);
                g.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
                chatEffects.splice(ei, 1); continue;
            }
            const decay = 1 - p;
            g.children.forEach(m => {
                const u = m.userData;
                m.position.x += u.vx * 0.025 * decay;
                m.position.y += u.vy * 0.025 * decay;
                m.position.z += u.vz * 0.025 * decay;
                m.rotation.x += u.rx * 0.03;
                m.rotation.y += u.ry * 0.03;
                m.rotation.z += u.rz * 0.03;
                if (u.t === "ocean" || u.t === "forest") m.position.x += Math.sin(d.age * 3 + m.id) * 0.008;
                if (u.t === "sunset") m.position.x += Math.cos(d.age * 2) * 0.005;
                m.material.opacity = Math.max(0, decay * decay);
                const sc = u.t === "neon" ? 1 + p * 3 : u.t === "midnight" ? 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(d.age * 5 + m.id)) : 1 + p * 0.5;
                m.scale.setScalar(sc);
            });
        }
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function apply3DTheme(theme) {
    currentTheme3D = theme;
    if (showingChatPhoto) {
        const url = themeBgs[theme] || themeBgs.naruko;
        document.body.style.backgroundImage = `url(${url})`;
    } else {
        document.body.style.backgroundImage = "none";
        if (particleScene && particleSystem) { particleScene.remove(particleSystem); }
        const result = buildParticles(theme3D[theme] || theme3D.naruko);
        particleSystem = result.system;
        particleMaterial = result.material;
        if (particleScene) particleScene.add(particleSystem);
    }
}

/* Called when user joins chat - switch from 3D particles to background photo */
function switchToPhoto(theme) {
    showingChatPhoto = true;
    document.body.classList.add("chat-mode");
    if (particleScene && particleSystem) { particleScene.remove(particleSystem); }
    particleSystem = null;
    const url = themeBgs[theme] || themeBgs.naruko;
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
}

/* Chat-reactive 3D effects - unique objects per theme */
let chatEffects = [];
const themeColors = {
    naruko: 0x4fd1c5, cyberpunk: 0xec4899, neon: 0x22d3ee,
    ocean: 0x3b82f6, romantic: 0xff69b4, midnight: 0x8b5cf6,
    forest: 0x22c55e, sunset: 0xf97316, light: 0x9ca3af,
};

function makeEffectMesh(t) {
    const theme = (t || "").trim().toLowerCase();
    const color = themeColors[theme] || 0x6366f1;
    const c = new THREE.Color(color);
    let geo, isWire = false;
    const mult = 2.2;
    if (theme === "naruko")        { geo = new THREE.SphereGeometry(0.3*mult, 10, 6); isWire = true; }
    else if (theme === "cyberpunk")  { geo = new THREE.BoxGeometry(0.5*mult, 0.5*mult, 0.5*mult); }
    else if (theme === "neon")     { geo = new THREE.TorusGeometry(0.3*mult, 0.08*mult, 12, 18); }
    else if (theme === "ocean")    { geo = new THREE.SphereGeometry(0.3*mult, 16, 12); }
    else if (theme === "romantic") { geo = new THREE.TorusKnotGeometry(0.3*mult, 0.1*mult, 32, 8); }
    else if (theme === "midnight") { geo = new THREE.OctahedronGeometry(0.45*mult); }
    else if (theme === "forest")   { geo = new THREE.ConeGeometry(0.15*mult, 0.5*mult, 6); }
    else if (theme === "sunset")   { geo = new THREE.IcosahedronGeometry(0.35*mult, 0); }
    else                           { geo = new THREE.ConeGeometry(0.2*mult, 0.4*mult, 4); }
    const mat = new THREE.MeshBasicMaterial({
        color: c, wireframe: isWire, transparent: true, opacity: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const a = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.random() * 1;
    mesh.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, (Math.random()-0.5) * 1.2);
    const sp = 0.4 + Math.random() * 0.3;
    mesh.userData = {
        vx: mesh.position.x * sp, vy: mesh.position.y * sp + (theme==="sunset"?1.2:theme==="forest"?-0.8:0), vz: mesh.position.z * sp,
        rx: (Math.random()-0.5)*6, ry: (Math.random()-0.5)*6, rz: (Math.random()-0.5)*6,
        t: theme,
    };
    return mesh;
}

function triggerChatEffect(type) {
    if (!particleScene) return;
    const t = currentTheme3D;
    const n = { message: 18, join: 12, typing: 5, follow: 28 }[type] || 10;
    const d = { message: 2.0, join: 2.5, typing: 1.2, follow: 2.5 }[type] || 1.5;
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) g.add(makeEffectMesh(t));
    g.userData = { age: 0, dur: d, n };
    chatEffects.push(g);
    particleScene.add(g);
}

async function handleGoogleCredential(response) {
    try {
        const res = await fetch("/google_login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();
        if (data.error) return alert("Google login failed: " + data.error);
        document.getElementById("username").value = data.username;
        googlePic = data.picture;
        googleName = data.name;
    } catch (e) {
        alert("Google login error. Check server is running.");
    }
}

window.handleGoogleCredential = handleGoogleCredential;

function joinChat() {
    const name = document.getElementById("username").value.trim();
    const room = document.getElementById("room").value.trim() || "general";
    if (!name) return alert("Please enter your name");
    username = name;
    reqNotif();
    switchToPhoto(currentTheme3D);
    document.getElementById("login").classList.add("hidden");
    document.getElementById("chat").classList.remove("hidden");
    document.getElementById("current-room").textContent = "#" + room;
    socket.emit("join", { username, room, google_pic: googlePic });
    document.getElementById("msg-input").focus();
}

function leaveChat() { location.reload(); }

function switchGoogleAccount() {
    google.accounts.id.disableAutoSelect();
    google.accounts.id.prompt();
}
function goToGeneral() {
    document.getElementById("current-room").textContent = "#general";
    document.getElementById("current-room").className = "";
    document.getElementById("go-general").classList.add("hidden");
    document.getElementById("messages").innerHTML = "";
    dmTarget = null;
    socket.emit("join", { username, room: "general", google_pic: googlePic });
}

let dmTarget = null;
function openDM(target) {
    dmTarget = target;
    document.getElementById("current-room").textContent = "@" + target;
    document.getElementById("current-room").className = "dm-header";
    document.getElementById("go-general").classList.remove("hidden");
    socket.emit("join_dm", { username, target });
}

function clearChat() {
    if (!confirm("Clear all messages in this room?")) return;
    document.getElementById("messages").innerHTML = "";
    socket.emit("clear_chat", {});
}

function send() {
    const input = document.getElementById("msg-input");
    const text = input.value.trim();
    if (!text) return;
    socket.emit("message", { text });
    input.value = "";
    input.focus();
}

function emitTyping() {
    if (!typingTimer) socket.emit("typing", { typing: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit("typing", { typing: false });
        typingTimer = null;
    }, 1500);
}

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("msg-input");
    if (input) {
        input.addEventListener("input", emitTyping);
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    }
});

function toggleEmojiPicker() {
    const picker = document.getElementById("emoji-picker");
    picker.classList.toggle("hidden");
    if (!picker.classList.contains("hidden") && !picker.children.length) {
        emojis.forEach(e => {
            const span = document.createElement("span");
            span.textContent = e;
            span.onclick = () => {
                document.getElementById("msg-input").value += e;
                document.getElementById("msg-input").focus();
                picker.classList.add("hidden");
            };
            picker.appendChild(span);
        });
    }
}

document.addEventListener("click", (e) => {
    const picker = document.getElementById("emoji-picker");
    const btn = document.getElementById("emoji-btn");
    if (!picker.classList.contains("hidden") && !picker.contains(e.target) && e.target !== btn) {
        picker.classList.add("hidden");
    }
});

function openProfile(targetUser) {
    if (!targetUser) return;
    socket.emit("get_profile", { username: targetUser });
}

function closeProfileModal() {
    document.getElementById("profile-modal").classList.add("hidden");
    document.getElementById("profile-edit").classList.add("hidden");
    document.getElementById("profile-display").classList.remove("hidden");
}

socket.on("profile_data", (data) => {
    if (data.error) return;
    const modal = document.getElementById("profile-modal");
    modal.classList.remove("hidden");
    const avatar = document.getElementById("profile-avatar");
    if (data.google_pic) {
        avatar.innerHTML = `<img src="${data.google_pic}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;">`;
    } else {
        avatar.textContent = data.avatar;
    }
    document.getElementById("profile-username").textContent = data.username;
    document.getElementById("profile-bio").textContent = data.bio;
    document.getElementById("profile-followers").textContent = data.followers;
    document.getElementById("profile-following").textContent = data.following;
    const status = document.getElementById("profile-status");
    status.textContent = data.online ? "● Online" : "○ Offline";
    status.className = "profile-status " + (data.online ? "online" : "offline");
    const actions = document.getElementById("profile-actions");
    actions.innerHTML = "";
    if (data.is_self) {
        const uploadBtn = document.createElement("button");
        uploadBtn.className = "btn-photo";
        uploadBtn.textContent = "📷 Change Photo";
        uploadBtn.onclick = () => { closeProfileModal(); document.getElementById('pic-upload').click(); };
        actions.appendChild(uploadBtn);
        const editBtn = document.createElement("button");
        editBtn.className = "btn-edit";
        editBtn.textContent = "Edit Profile";
        editBtn.onclick = () => openEditProfile(data);
        actions.appendChild(editBtn);
        if (googlePic) {
            const switchBtn = document.createElement("button");
            switchBtn.className = "btn-edit";
            switchBtn.textContent = "🔄 Switch Google";
            switchBtn.onclick = () => { closeProfileModal(); switchGoogleAccount(); };
            actions.appendChild(switchBtn);
        }
    } else {
        if (data.is_following) {
            const btn = document.createElement("button");
            btn.className = "btn-unfollow";
            btn.textContent = "Unfollow";
            btn.onclick = () => socket.emit("unfollow", { username: data.username });
            actions.appendChild(btn);
        } else {
            const btn = document.createElement("button");
            btn.className = "btn-follow";
            btn.textContent = "Follow";
            btn.onclick = () => socket.emit("follow", { username: data.username });
            actions.appendChild(btn);
        }
        const dmBtn = document.createElement("button");
        dmBtn.className = "btn-dm";
        dmBtn.textContent = "💬 Message";
        dmBtn.onclick = () => { closeProfileModal(); openDM(data.username); };
        actions.appendChild(dmBtn);
        const videoBtn = document.createElement("button");
        videoBtn.className = "btn-call";
        videoBtn.textContent = "📹 Video";
        videoBtn.title = `Video call ${data.username}`;
        videoBtn.onclick = () => { closeProfileModal(); initiateCall(data.username, false); };
        actions.appendChild(videoBtn);
        const audioBtn = document.createElement("button");
        audioBtn.className = "btn-call";
        audioBtn.textContent = "🔊 Audio";
        audioBtn.title = `Audio call ${data.username}`;
        audioBtn.onclick = () => { closeProfileModal(); initiateCall(data.username, true); };
        actions.appendChild(audioBtn);
    }
});

function openEditProfile(data) {
    document.getElementById("profile-display").classList.add("hidden");
    document.getElementById("profile-edit").classList.remove("hidden");
    document.getElementById("bio-input").value = data.bio || "";
    const picker = document.getElementById("avatar-picker");
    picker.innerHTML = "";
    const avatars = ["😎","🦸","🧙","🚀","🎮","🦊","🐉","👑","💻","🎸","🌈","🔥","⭐","🦋","🍕","🌙"];
    avatars.forEach(a => {
        const span = document.createElement("span");
        span.textContent = a;
        span.className = a === data.avatar ? "selected" : "";
        span.dataset.avatar = a;
        span.onclick = () => {
            picker.querySelectorAll("span").forEach(s => s.classList.remove("selected"));
            span.classList.add("selected");
        };
        picker.appendChild(span);
    });
}

function cancelEditProfile() {
    document.getElementById("profile-edit").classList.add("hidden");
    document.getElementById("profile-display").classList.remove("hidden");
}

function saveProfile() {
    const bio = document.getElementById("bio-input").value.trim();
    const selected = document.querySelector("#avatar-picker span.selected");
    const avatar = selected ? selected.dataset.avatar : "";
    socket.emit("update_profile", { bio, avatar });
    closeProfileModal();
}

let cropperInstance = null;

function handlePicUpload(input) {
    if (!input.files || !input.files[0]) return;
    const img = document.createElement("img");
    img.id = "crop-preview";
    const container = document.getElementById("crop-container");
    container.innerHTML = "";
    container.appendChild(img);
    const reader = new FileReader();
    reader.onload = (ev) => {
        img.src = ev.target.result;
        img.onload = () => {
            document.getElementById("crop-modal").classList.remove("hidden");
            if (cropperInstance) cropperInstance.destroy();
            cropperInstance = new Cropper(img, {
                aspectRatio: 1, viewMode: 1, autoCropArea: 1,
                movable: true, zoomable: true, rotatable: false,
            });
        };
    };
    reader.readAsDataURL(input.files[0]);
    input.value = "";
}

function closeCropModal() {
    document.getElementById("crop-modal").classList.add("hidden");
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
}

function applyCrop() {
    if (!cropperInstance) return;
    const base64 = cropperInstance.getCroppedCanvas({ width: 256, height: 256 }).toDataURL("image/jpeg", 0.9);
    socket.emit("upload_profile_pic", { image: base64 });
    closeCropModal();
}

socket.on("profile_pic_updated", (data) => {
    if (data.username === username) {
        googlePic = data.google_pic;
        document.querySelectorAll("#messages .msg.self .msg-pic").forEach(el => {
            if (el.tagName === "IMG") el.src = data.google_pic;
            else { const img = document.createElement("img"); img.className = "msg-pic"; img.src = data.google_pic; el.replaceWith(img); }
        });
    } else {
        document.querySelectorAll(`#messages .msg.other .name[onclick*="${escapeHtml(data.username)}"]`).forEach(() => {
            location.reload();
        });
    }
});

socket.on("profile_updated", (data) => {
    const msgs = document.querySelectorAll("#messages .msg-body .name");
});

function makePicHtml(data, isSelf) {
    const click = isSelf ? "" : ` onclick="openProfile('${escapeHtml(data.user)}')" style="cursor:pointer"`;
    if (data.google_pic) return `<img class="msg-pic" src="${escapeHtml(data.google_pic)}" alt=""${click}>`;
    return `<span class="msg-pic emoji"${click}>${data.avatar || "😎"}</span>`;
}

function addMessage(data, noAnim) {
    const div = document.createElement("div");
    div.className = "msg";
    if (data.id) div.dataset.msgId = data.id;
    const time = data.time ? new Date(data.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    if (data.user === "System") {
        div.classList.add("system");
        div.textContent = data.text;
        if (!noAnim && (data.text.includes("joined") || data.text.includes("started following"))) {
            triggerChatEffect("join");
        } else if (!noAnim && data.text.includes("follow")) {
            triggerChatEffect("follow");
        }
    } else if (data.user === username) {
        div.classList.add("self");
        const isImage = data.msg_type === "image";
        const isAudio = data.msg_type === "audio";
        const isVoice = isAudio && data.voice;
        let textHtml;
        if (isImage) textHtml = `<img src="${escapeHtml(data.text)}" class="msg-img" loading="lazy">`;
        else if (isVoice) textHtml = `<div class="voice-msg"><span class="voice-icon">🎤</span><audio src="${escapeHtml(data.text)}" controls class="msg-audio" preload="none"></audio></div>`;
        else if (isAudio) textHtml = `<audio src="${escapeHtml(data.text)}" controls class="msg-audio" preload="none"></audio>`;
        else textHtml = `<div class="text">${escapeHtml(data.text)}</div>`;
        const delBtn = data.id ? `<button class="msg-del" onclick="deleteMsg(${data.id})" title="Delete">✕</button>` : "";
        div.innerHTML = `${makePicHtml(data, true)}<div class="msg-body">${delBtn}<div class="name">You</div>${textHtml}<div class="time">${time}</div></div>`;
        if (!noAnim) triggerChatEffect("message");
    } else {
        div.classList.add("other");
        const isImage = data.msg_type === "image";
        const isAudio = data.msg_type === "audio";
        const isVoice = isAudio && data.voice;
        let textHtml;
        if (isImage) textHtml = `<img src="${escapeHtml(data.text)}" class="msg-img" loading="lazy">`;
        else if (isVoice) textHtml = `<div class="voice-msg"><span class="voice-icon">🎤</span><audio src="${escapeHtml(data.text)}" controls class="msg-audio" preload="none"></audio></div>`;
        else if (isAudio) textHtml = `<audio src="${escapeHtml(data.text)}" controls class="msg-audio" preload="none"></audio>`;
        else textHtml = `<div class="text">${escapeHtml(data.text)}</div>`;
        div.innerHTML = `${makePicHtml(data, false)}<div class="msg-body"><div class="name" onclick="openProfile('${escapeHtml(data.user)}')">${escapeHtml(data.user)}</div>${textHtml}<div class="time">${time}</div></div>`;
    }
    if (noAnim) div.style.animation = "none";
    document.getElementById("messages").appendChild(div);
    div.scrollIntoView({ behavior: noAnim ? "auto" : "smooth" });
    if (!noAnim && data.user !== "System" && data.user !== username) {
        if ("Notification" in window && Notification.permission === "granted" && !windowFocused) {
            const roomLabel = document.getElementById("current-room").textContent || "#general";
            const n = new Notification(roomLabel, { body: `${data.user}: ${data.text}`, icon: data.google_pic || undefined });
            setTimeout(() => n.close(), 5000);
        }
        playNotifSound();
    }
}

function updateUsers(data) {
    const list = document.getElementById("user-list");
    list.innerHTML = data.users.map(u => {
        if (u === username) return `<div class="user-self" onclick="openProfile('${escapeHtml(u)}')"><span class="online-dot"></span>${escapeHtml(u)}</div>`;
        return `<div class="user-row"><span class="online-dot"></span><span onclick="openProfile('${escapeHtml(u)}')">${escapeHtml(u)}</span><button class="user-call" onclick="initiateCall('${escapeHtml(u)}', false)" title="Video call ${escapeHtml(u)}">📹</button><button class="user-call" onclick="initiateCall('${escapeHtml(u)}', true)" title="Audio call ${escapeHtml(u)}">🔊</button><button class="user-dm" onclick="openDM('${escapeHtml(u)}')" title="DM ${escapeHtml(u)}">💬</button></div>`;
    }).join("");
}

const typingUsers = new Set();
let typingHideTimer = null;

let typingPulseTimer = null;

function updateTyping(data) {
    const indicator = document.getElementById("typing-indicator");
    const text = document.getElementById("typing-text");
    if (data.typing) {
        typingUsers.add(data.user);
        if (!typingPulseTimer) {
            typingPulseTimer = setInterval(() => triggerChatEffect("typing"), 600);
        }
    } else {
        typingUsers.delete(data.user);
    }
    clearTimeout(typingHideTimer);
    if (typingUsers.size > 0) {
        const names = Array.from(typingUsers);
        if (names.length === 1) text.textContent = `${names[0]} is typing`;
        else if (names.length === 2) text.textContent = `${names[0]} and ${names[1]} are typing`;
        else text.textContent = `${names[0]} and ${names.length - 1} others are typing`;
        indicator.classList.remove("hidden");
    } else {
        clearInterval(typingPulseTimer);
        typingPulseTimer = null;
        typingHideTimer = setTimeout(() => indicator.classList.add("hidden"), 300);
    }
}

function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
    const loading = document.getElementById("loading-screen");
    const spans = loading.querySelectorAll("span");
    spans.forEach((s, i) => s.style.animationDelay = `${i * 0.08}s`);
    const totalDelay = spans.length * 0.08 + 1.5;
    setTimeout(() => {
        loading.classList.add("fade-out");
        setTimeout(() => { loading.style.display = "none"; }, 800);
    }, totalDelay * 1000);
});

initThemeSwitcher();
init3D();
/* === Call (WebRTC) === */
let callTarget = null;
let isCaller = false;
let peerConnection = null;
let localStream = null;
let isMuted = false;
let callAudioOnly = false;
let iceCandidateQueue = [];
const STUN = { urls: "stun:stun.l.google.com:19302" };

function getPC() {
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection({ iceServers: [STUN] });
        peerConnection.onicecandidate = (e) => {
            if (e.candidate && callTarget) {
                socket.emit("call_ice_candidate", { target: callTarget, candidate: e.candidate });
            }
        };
        peerConnection.ontrack = (e) => {
            document.getElementById("remote-video").srcObject = e.streams[0];
        };
        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection && (peerConnection.iceConnectionState === "disconnected" || peerConnection.iceConnectionState === "failed")) {
                endCall();
            }
        };
    }
    return peerConnection;
}

async function startMedia(audioOnly) {
    try {
        const constraints = audioOnly ? { audio: true } : { video: true, audio: true };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById("local-video").srcObject = audioOnly ? null : localStream;
        if (audioOnly) document.getElementById("call-videos").classList.remove("active");
        return true;
    } catch (e) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            document.getElementById("local-video").srcObject = null;
            return true;
        } catch (e2) {
            alert("Microphone access is needed for calls.");
            return false;
        }
    }
}

function stopMedia() {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    document.getElementById("local-video").srcObject = null;
    document.getElementById("remote-video").srcObject = null;
}

function showIncomingCall(from, audioOnly) {
    callTarget = from;
    isCaller = false;
    callAudioOnly = audioOnly;
    document.getElementById("caller-name").textContent = from;
    document.getElementById("caller-audio-only").style.display = audioOnly ? "block" : "none";
    document.getElementById("caller-call-msg").textContent = audioOnly ? "wants audio call..." : "is calling...";
    document.getElementById("incoming-call").classList.remove("hidden");
    playRingSound();
}

async function initiateCall(target, audioOnly) {
    if (target === username) return;
    callTarget = target;
    isCaller = true;
    document.getElementById("active-caller-name").textContent = target;
    document.getElementById("call-status").textContent = "Calling...";
    document.getElementById("active-call").classList.remove("hidden");
    document.getElementById("call-videos").classList.remove("active");
    if (!await startMedia(audioOnly)) { cleanupCall(); return; }
    socket.emit("call_user", { target, audioOnly: !!audioOnly });
}

async function acceptCall() {
    const audioOnly = callAudioOnly;
    stopRingSound();
    document.getElementById("incoming-call").classList.add("hidden");
    document.getElementById("active-caller-name").textContent = callTarget;
    document.getElementById("call-status").textContent = "Connecting...";
    document.getElementById("active-call").classList.remove("hidden");
    document.getElementById("call-videos").classList.remove("active");
    if (!await startMedia(audioOnly)) { cleanupCall(); return; }
    socket.emit("call_accept", { target: callTarget });
    const pc = getPC();
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
}

function rejectCall() {
    stopRingSound();
    document.getElementById("incoming-call").classList.add("hidden");
    if (callTarget) socket.emit("call_reject", { target: callTarget });
    callTarget = null;
}

function cleanupCall() {
    stopRingSound();
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    stopMedia();
    isMuted = false;
    callAudioOnly = false;
    document.getElementById("call-mute-btn").className = "call-mute-btn";
    document.getElementById("call-mute-btn").textContent = "🔊 Mute";
    document.getElementById("call-videos").classList.remove("active");
    iceCandidateQueue = [];
}

function endCall() {
    if (callTarget) socket.emit("call_end", { target: callTarget });
    cleanupCall();
    callTarget = null;
    isCaller = false;
    document.getElementById("active-call").classList.add("hidden");
    document.getElementById("incoming-call").classList.add("hidden");
}

function toggleMute() {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    const btn = document.getElementById("call-mute-btn");
    btn.className = "call-mute-btn" + (isMuted ? " muted" : "");
    btn.textContent = isMuted ? "🔇 Unmute" : "🔊 Mute";
}

/* Call SocketIO events */
socket.on("incoming_call", (data) => {
    if (!callTarget) showIncomingCall(data.from, data.audioOnly);
});
socket.on("call_accepted", async (data) => {
    document.getElementById("call-status").textContent = "Connecting...";
    document.getElementById("call-videos").classList.add("active");
    const pc = getPC();
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call_offer", { target: callTarget, sdp: pc.localDescription });
    } catch (e) { console.error(e); endCall(); }
});
socket.on("call_rejected", () => {
    cleanupCall();
    callTarget = null; isCaller = false;
    document.getElementById("active-call").classList.add("hidden");
});
socket.on("call_ended", () => {
    cleanupCall();
    callTarget = null; isCaller = false;
    document.getElementById("active-call").classList.add("hidden");
    document.getElementById("incoming-call").classList.add("hidden");
});
socket.on("user_offline", () => {
    cleanupCall();
    callTarget = null; isCaller = false;
    document.getElementById("active-call").classList.add("hidden");
});
socket.on("call_offer", async (data) => {
    const pc = getPC();
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call_answer", { target: callTarget, sdp: pc.localDescription });
        document.getElementById("call-status").textContent = "Connected";
        document.getElementById("call-videos").classList.add("active");
        while (iceCandidateQueue.length) {
            await pc.addIceCandidate(iceCandidateQueue.shift());
        }
    } catch (e) { console.error(e); endCall(); }
});
socket.on("call_answer", async (data) => {
    const pc = getPC();
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        document.getElementById("call-status").textContent = "Connected";
        document.getElementById("call-videos").classList.add("active");
        while (iceCandidateQueue.length) {
            await pc.addIceCandidate(iceCandidateQueue.shift());
        }
    } catch (e) { console.error(e); endCall(); }
});
socket.on("call_ice_candidate", async (data) => {
    const pc = getPC();
    try {
        if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
            iceCandidateQueue.push(new RTCIceCandidate(data.candidate));
        }
    } catch (e) { /* ignore */ }
});

socket.on("history", (data) => {
    const msgs = document.getElementById("messages");
    msgs.innerHTML = "";
    if (data.messages) {
        data.messages.forEach(m => {
            const msgData = { id: m.id, user: m.username, text: m.text, time: m.time, avatar: m.avatar, google_pic: m.google_pic, msg_type: m.msg_type, voice: m.voice };
            if (m.username === "System") msgData.user = "System";
            addMessage(msgData, true);
        });
    }
});
socket.on("dm_joined", (data) => {
    document.getElementById("current-room").textContent = "@" + data.target;
    document.getElementById("current-room").className = "dm-header";
});
function deleteMsg(id) {
    if (!confirm("Delete this message?")) return;
    socket.emit("delete_message", { id });
}

let ringInterval = null;
function playRingSound() {
    stopRingSound();
    function ringTone() {
        try {
            const a = new (window.AudioContext || window.webkitAudioContext)();
            const master = a.createGain();
            master.connect(a.destination);
            master.gain.value = 0.4;
            master.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.8);

            const tone = (freq, start, dur) => {
                const osc = a.createOscillator();
                const g = a.createGain();
                osc.type = "sine";
                osc.frequency.value = freq;
                g.gain.setValueAtTime(1, start);
                g.gain.exponentialRampToValueAtTime(0.001, start + dur);
                osc.connect(g);
                g.connect(master);
                osc.start(start);
                osc.stop(start + dur);
            };

            tone(700, a.currentTime, 0.15);
            tone(760, a.currentTime + 0.15, 0.15);
            tone(700, a.currentTime + 0.35, 0.15);
            tone(760, a.currentTime + 0.5, 0.15);
        } catch(e) {}
    }
    ringTone();
    ringInterval = setInterval(ringTone, 1200);
}
function stopRingSound() {
    if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
}

function playNotifSound() {
    try {
        const a = new AudioContext();
        const g = a.createGain();
        g.connect(a.destination);
        g.gain.value = 0.15;
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.15);
        const o = a.createOscillator();
        o.type = "sine";
        o.frequency.value = 660;
        o.connect(g);
        o.start();
        o.stop(a.currentTime + 0.15);
    } catch(e) {}
}

let mediaRecorder = null;
let voiceChunks = [];
let voiceTimer = null;
let voiceSec = 0;

function toggleVoiceRecord() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Recording not supported in this browser");
        return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        voiceChunks = [];
        voiceSec = 0;
        document.getElementById("voice-sec").textContent = "0";
        document.getElementById("voice-timer").classList.remove("hidden");
        document.getElementById("voice-btn").textContent = "⏹";
        document.getElementById("voice-btn").classList.add("recording");
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
        mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) voiceChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            clearInterval(voiceTimer);
            document.getElementById("voice-timer").classList.add("hidden");
            document.getElementById("voice-btn").textContent = "🎤";
            document.getElementById("voice-btn").classList.remove("recording");
            if (voiceChunks.length === 0) return;
            const blob = new Blob(voiceChunks, { type: mime });
            if (blob.size < 200) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target.result;
                if (data.length > 1000000) { alert("Voice message too large"); return; }
                socket.emit("share_audio", { audio: data, voice: true });
            };
            reader.readAsDataURL(blob);
            voiceChunks = [];
        };
        mediaRecorder.start(100);
        voiceTimer = setInterval(() => {
            voiceSec++;
            document.getElementById("voice-sec").textContent = voiceSec;
        }, 1000);
    }).catch(() => alert("Microphone access denied"));
}

function shareAudio() {
    const input = document.getElementById("audio-upload");
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target.result;
        if (data.length > 1000000) { alert("Audio too large (max 1MB)"); return; }
        socket.emit("share_audio", { audio: data });
    };
    reader.readAsDataURL(input.files[0]);
    input.value = "";
}

function shareImage() {
    const input = document.getElementById("img-upload");
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        let data = e.target.result;
        if (data.length > 1000000) {
            const img = new Image();
            img.onload = () => {
                const maxW = 1920, maxH = 1920;
                let w = img.width, h = img.height;
                if (w > maxW || h > maxH) {
                    const r = Math.min(maxW / w, maxH / h);
                    w = Math.round(w * r); h = Math.round(h * r);
                }
                const c = document.createElement("canvas");
                c.width = w; c.height = h;
                const ctx = c.getContext("2d");
                ctx.drawImage(img, 0, 0, w, h);
                data = c.toDataURL("image/jpeg", 0.85);
                if (data.length > 20000000) { alert("Image too large even after compression"); return; }
                socket.emit("share_image", { image: data });
            };
            img.src = data;
        } else {
            socket.emit("share_image", { image: data });
        }
    };
    reader.readAsDataURL(file);
    input.value = "";
}

socket.on("message_deleted", (data) => {
    const el = document.querySelector(`.msg[data-msg-id="${data.id}"]`);
    if (el) el.remove();
});

socket.on("chat_cleared", () => {
    document.getElementById("messages").innerHTML = "";
});
socket.on("message", addMessage);
socket.on("users", updateUsers);
socket.on("typing", updateTyping);
