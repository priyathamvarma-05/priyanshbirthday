/* =============================================
   SPACE BIRTHDAY INVITATION — SCRIPT
   Background removal done via Canvas pixel flood-fill.
   No CSS blend-mode hacks needed.
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    buildStarField();
    buildFloatingImages();
    applyBgRemovalToCenter();
    initLaunchAnimation();

    // Start shooting stars loop
    setTimeout(spawnShootingStar, rand(1000, 3000));
});

/* =============================================
   BACKGROUND REMOVAL — Canvas Flood-Fill
   Samples corner pixels to detect bg colour,
   then BFS-erases all connected matching pixels.
   Works for white, black, or any solid bg.
   ============================================= */
function removeBackground(imgEl, tolerance) {
    tolerance = (tolerance !== undefined) ? tolerance : 55;

    function process() {
        const w = imgEl.naturalWidth;
        const h = imgEl.naturalHeight;
        if (!w || !h) return;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        try {
            ctx.drawImage(imgEl, 0, 0);
        } catch (e) { return; } // tainted canvas (CORS) — skip

        let imageData;
        try {
            imageData = ctx.getImageData(0, 0, w, h);
        } catch (e) { return; }

        const d = imageData.data; // flat RGBA array

        // --- Sample bg colour from the 4 corners ---
        function px(x, y) {
            const i = (y * w + x) * 4;
            return [d[i], d[i + 1], d[i + 2]];
        }
        const samples = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
        const bg = samples.reduce(
            (acc, c) => [acc[0] + c[0] / 4, acc[1] + c[1] / 4, acc[2] + c[2] / 4],
            [0, 0, 0]
        );

        // --- Colour distance ---
        function dist(x, y) {
            const i = (y * w + x) * 4;
            const dr = d[i] - bg[0];
            const dg = d[i + 1] - bg[1];
            const db = d[i + 2] - bg[2];
            return Math.sqrt(dr * dr + dg * dg + db * db);
        }

        // --- BFS flood-fill from edges ---
        const visited = new Uint8Array(w * h);
        // We push x and y as alternating pairs for speed
        const qx = new Int32Array(w * h);
        const qy = new Int32Array(w * h);
        let head = 0, tail = 0;

        function enqueue(x, y) {
            if (x < 0 || x >= w || y < 0 || y >= h) return;
            const idx = y * w + x;
            if (visited[idx]) return;
            if (dist(x, y) > tolerance) return;
            visited[idx] = 1;
            qx[tail] = x;
            qy[tail] = y;
            tail++;
        }

        // Seed from all 4 corners
        enqueue(0, 0);
        enqueue(w - 1, 0);
        enqueue(0, h - 1);
        enqueue(w - 1, h - 1);

        // Seed from top/bottom edge strips (every 8px) for gradient borders
        for (let x = 0; x < w; x += 8) {
            enqueue(x, 0);
            enqueue(x, h - 1);
        }
        // Seed left/right edge strips
        for (let y = 0; y < h; y += 8) {
            enqueue(0, y);
            enqueue(w - 1, y);
        }

        // BFS
        while (head < tail) {
            const x = qx[head];
            const y = qy[head];
            head++;

            // Erase this pixel (fully transparent)
            const i = (y * w + x) * 4;
            d[i + 3] = 0;

            enqueue(x + 1, y);
            enqueue(x - 1, y);
            enqueue(x, y + 1);
            enqueue(x, y - 1);
        }

        // --- Feather edges: soften pixels next to transparent ones ---
        // (1-pixel pass to smooth the jagged cut-out edge)
        const alpha = new Uint8Array(w * h); // store new alphas
        for (let n = 0; n < w * h; n++) alpha[n] = d[n * 4 + 3];

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = (y * w + x) * 4;
                if (d[i + 3] === 0) continue; // already transparent
                // If any neighbour is transparent → soften this pixel
                const hasTransparentNeighbour =
                    alpha[(y - 1) * w + x] === 0 ||
                    alpha[(y + 1) * w + x] === 0 ||
                    alpha[y * w + (x - 1)] === 0 ||
                    alpha[y * w + (x + 1)] === 0;
                if (hasTransparentNeighbour) {
                    d[i + 3] = Math.round(d[i + 3] * 0.5);
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);

        try {
            // Replace the image src with the processed transparent PNG
            imgEl.src = canvas.toDataURL('image/png');
        } catch (e) { /* security error */ }
    }

    // Run after image is fully loaded
    if (imgEl.complete && imgEl.naturalWidth > 0) {
        process();
    } else {
        imgEl.addEventListener('load', process, { once: true });
    }
}

/* =============================================
   CENTER IMAGE — apply bg removal
   ============================================= */
function applyBgRemovalToCenter() {
    const img = document.getElementById('main-invitation');
    if (!img) return;

    img.onerror = () => img.remove();
    // Higher tolerance (80) + extra seeds handle gradient/dark backgrounds
    removeBackground(img, 80);
}

/* =============================================
   1. STAR FIELD
   Two nested divs per star:
   - Outer handles slow drift
   - Inner handles twinkle (separate transforms)
   ============================================= */
function buildStarField() {
    const layer = document.getElementById('star-layer');
    const isMobile = window.innerWidth < 768;
    const COUNT = isMobile ? 120 : 280;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < COUNT; i++) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            position: absolute;
            left: ${rand(0, 100)}vw;
            top:  ${rand(0, 100)}vh;
            will-change: transform;
            animation: star-drift ${rand(25, 55)}s ease-in-out ${rand(-30, 0)}s infinite alternate;
        `;

        const dot = document.createElement('div');
        const size = rand(0.6, 2.8);
        const anim = Math.random() > 0.5 ? 'twinkle-a' : 'twinkle-b';

        dot.classList.add('star');
        dot.style.cssText = `
            width:  ${size}px;
            height: ${size}px;
            background: ${starColor()};
            animation: ${anim} ${rand(2.5, 6)}s ease-in-out ${rand(-5, 0)}s infinite;
        `;

        wrapper.appendChild(dot);
        frag.appendChild(wrapper);
    }

    layer.appendChild(frag);
}

function starColor() {
    return `rgb(${Math.floor(rand(200, 255))},${Math.floor(rand(200, 255))},${Math.floor(rand(210, 255))})`;
}

/* =============================================
   2. CORNER DECORATIVE IMAGES
   Fixed placement for specific elements.
   Background removal applied to each image on load.
   ============================================= */
function buildFloatingImages() {
    const layer = document.getElementById('floating-layer');

    const ITEMS = [
        {
            file: 'Adobe Express - file.png',
            positionCSS: 'left: 3vw; bottom: 3vh;',
            size: 280
        },
        {
            file: 'Untitled.png',
            positionCSS: 'right: 3vw; top: 3vh;',
            size: 280
        }
    ];

    const frag = document.createDocumentFragment();

    ITEMS.forEach((item) => {
        const opacity = 1.0;

        const img = document.createElement('img');
        img.src = `Images/random_images/${item.file}`;
        img.alt = '';
        img.draggable = false;
        img.classList.add('corner-img');

        img.style.cssText = `
            position: absolute;
            object-fit: contain;
            pointer-events: none;
            ${item.positionCSS}
            width:   ${item.size}px;
            opacity: ${opacity};
        `;

        // Remove background pixels, then silently drop if broken
        img.onerror = () => img.remove();
        removeBackground(img, 55);

        frag.appendChild(img);
    });

    layer.appendChild(frag);
}

/* =============================================
   ROCKET LAUNCH INTERACTION
   ============================================= */
function initLaunchAnimation() {
    const mainCard = document.getElementById('main-card');
    const smokeScreen = document.getElementById('smoke-screen');
    const revealTextLayer = document.getElementById('reveal-text-layer');
    if (!mainCard) return;

    let launched = false;

    mainCard.addEventListener('click', () => {
        if (launched) return;
        launched = true;

        // 1. Launch Rocket
        mainCard.classList.add('launching');

        // 3. Full Screen Smoke Transition - temporarily disabled
        // setTimeout(() => {
        //     if (smokeScreen) smokeScreen.classList.add('fill-screen');
        // }, 1200);

        // 4. Reveal Text - adjusted to match rocket timing
        setTimeout(() => {
            if (revealTextLayer) revealTextLayer.classList.add('show');
        }, 1200);
    });
}

function spawnSmoke() {
    const mainCard = document.getElementById('main-card');
    const smokeLayer = document.getElementById('smoke-screen');
    if (!mainCard || !smokeLayer) return;

    // Get current animated position of the rocket
    const rect = mainCard.getBoundingClientRect();

    // Position smoke near the engines (bottom-center)
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height * 0.9;

    const particle = document.createElement('div');
    particle.classList.add('smoke-particle');

    // Add minor random jitter
    const jitterX = rand(-15, 15);
    const jitterY = rand(0, 20);

    particle.style.left = `${x + jitterX - 30}px`; // offset by half width of smoke (.smoke-particle is 60x60)
    particle.style.top = `${y + jitterY - 30}px`;

    // Append to smoke container temporarily
    smokeLayer.appendChild(particle);

    // Clean up DOM nodes after animation completes to keep performance high
    setTimeout(() => {
        if (particle.parentNode) {
            particle.parentNode.removeChild(particle);
        }
    }, 1500);
}

/* =============================================
   SHOOTING STARS LOOP
   ============================================= */
function spawnShootingStar() {
    const layer = document.getElementById('star-layer');
    if (!layer) return;

    const star = document.createElement('div');
    star.classList.add('shooting-star');

    // Randomize spawn along the top/left bounding area
    const startY = rand(-20, 80);
    const startX = rand(-20, 40);

    star.style.left = `${startX}vw`;
    star.style.top = `${startY}vh`;

    layer.appendChild(star);

    // Clean up DOM after animation completes
    setTimeout(() => {
        if (star.parentNode) star.parentNode.removeChild(star);
    }, 5000);

    // Schedule next star (random interval between 1s and 2.5s ensures min 2 per 5s)
    setTimeout(spawnShootingStar, rand(1000, 2500));
}

/* =============================================
   UTILITY
   ============================================= */
function rand(min, max) {
    return Math.random() * (max - min) + min;
}
