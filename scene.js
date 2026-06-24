/* ============================================================
   Direction F — The Long Hall · Three.js gallery corridor
   Framed expo photographs receding into haze; the camera glides
   forward as the page scrolls. Exposes window.initLongHall().
   ============================================================ */
(function () {
  function downscale(img, maxW) {
    var s = Math.min(1, maxW / img.naturalWidth);
    var w = Math.max(1, Math.round(img.naturalWidth * s));
    var h = Math.max(1, Math.round(img.naturalHeight * s));
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; else tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return { tex: tex, aspect: img.naturalWidth / img.naturalHeight };
  }
  function loadImage(url) {
    return new Promise(function (res) {
      var im = new Image(); im.crossOrigin = "anonymous";
      im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = url;
    });
  }

  function initLongHall(opts) {
    opts = opts || {};
    var canvas = opts.canvas, urls = opts.images || [];
    var onReady = opts.onReady || function () {};
    var onProgressLoad = opts.onProgressLoad || function () {};
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var paperHex = opts.paper || "#f1ece1";

    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: "high-performance" }); }
    catch (e) { return { fail: true }; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace; else renderer.outputEncoding = THREE.sRGBEncoding;

    var scene = new THREE.Scene();
    var paper = new THREE.Color(paperHex);
    scene.background = paper;
    scene.fog = new THREE.Fog(paper, 7, 33);

    var camera = new THREE.PerspectiveCamera(56, 1, 0.1, 120);
    camera.position.set(0, 0.2, 4.5);

    var SPACING = 3.7;
    var SIDE_X = 2.42;
    var group = new THREE.Group();
    scene.add(group);
    var frameMats = [];

    /* floor + ceiling for enclosure */
    var floorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(paperHex).multiplyScalar(0.9), fog: true });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 260), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -2.5, -120); scene.add(floor);
    var ceilMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(paperHex).multiplyScalar(1.18), fog: true });
    var ceil = new THREE.Mesh(new THREE.PlaneGeometry(40, 260), ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.0, -120); scene.add(ceil);

    var endZ = -SPACING;

    function buildPanels(textures) {
      var count = 18;
      for (var i = 0; i < count; i++) {
        var t = textures[i % textures.length];
        var side = (i % 2 === 0) ? -1 : 1;
        var z = -1.5 - i * SPACING + (Math.random() - 0.5) * 0.5;
        endZ = z;
        var baseW = 2.7 + ((i * 37) % 10) / 10 * 0.9; // 2.7..3.6 deterministic-ish
        var w = baseW, h = baseW / t.aspect;
        if (h > 2.9) { h = 2.9; w = h * t.aspect; }

        var g = new THREE.Group();
        g.position.set(side * SIDE_X, 0.1 + (Math.random() - 0.5) * 0.5, z);
        g.rotation.y = side === -1 ? 0.34 : -0.34;

        // mat / frame — soft lit mat (blend toward white so it reads on dark walls)
        var frameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(paperHex).lerp(new THREE.Color(0xffffff), 0.16), fog: true });
        var frame = new THREE.Mesh(
          new THREE.PlaneGeometry(w + 0.22, h + 0.22),
          frameMat
        );
        frame.position.z = -0.03;
        g.add(frame);
        frameMats.push(frameMat);

        var photo = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ map: t.tex, fog: true })
        );
        g.add(photo);
        group.add(g);
      }
    }

    var ready = false;
    Promise.all(urls.map(function (u, i) {
      return loadImage(u).then(function (im) { onProgressLoad((i + 1) / urls.length); return im; });
    })).then(function (imgs) {
      try {
        var got = imgs.filter(Boolean);
        if (!got.length) { onReady(false); return; }
        var textures = got.map(function (im) { return downscale(im, 1100); });
        buildPanels(textures);
        ready = true;
      } catch (err) { console.error("[hall] build error:", err); }
      onReady(ready);
      try { resize(); render(); } catch (err2) { console.error("[hall] first render error:", err2); }
    }).catch(function (err) { console.error("[hall] load chain error:", err); onReady(false); });

    /* camera travel */
    var travelStart = 4.5;
    var travelEnd = endZ - 5; // updated after build; recompute on first setProgress
    var progress = 0, targetProgress = 0;
    var mx = 0, my = 0, tmx = 0, tmy = 0;

    function camZForProgress(p) {
      var end = endZ - 4.5;
      return travelStart + (end - travelStart) * p;
    }

    function setProgress(p) { targetProgress = Math.max(0, Math.min(1, p)); }

    function resize() {
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    function render() { renderer.render(scene, camera); }

    var rafId = null, running = false, loggedLoopErr = false;
    function loop() {
      try {
        progress += (targetProgress - progress) * 0.12;
        mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
        var t = performance.now() * 0.0002;
        camera.position.z = camZForProgress(progress);
        camera.position.x = mx * 0.7 + Math.sin(t) * 0.18;
        camera.position.y = 0.2 + my * -0.4 + Math.cos(t * 0.8) * 0.06;
        camera.lookAt(Math.sin(t) * 0.1, 0.1, camera.position.z - 6);
        render();
      } catch (e) { if (!loggedLoopErr) { console.error("[hall] loop error:", e); loggedLoopErr = true; } }
      if (running) rafId = requestAnimationFrame(loop);
    }
    function play() { if (!running && !reduce) { running = true; rafId = requestAnimationFrame(loop); } }
    function pause() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }

    window.addEventListener("resize", resize);
    if (!reduce && window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("pointermove", function (e) {
        tmx = (e.clientX / window.innerWidth - 0.5) * 2;
        tmy = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else play(); });
    play();

    /* reduced motion: render on scroll only */
    if (reduce) {
      var staticRender = function () { progress = targetProgress; camera.position.z = camZForProgress(progress); camera.lookAt(0, 0.1, camera.position.z - 6); render(); };
      window.addEventListener("scroll", staticRender, { passive: true });
    }

    return {
      setProgress: setProgress,
      setColors: function (hex) {
        paper.set(hex); scene.background = paper; scene.fog.color.set(hex);
        floorMat.color.set(new THREE.Color(hex).multiplyScalar(0.9));
        ceilMat.color.set(new THREE.Color(hex).multiplyScalar(1.18));
        var fc = new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.16);
        frameMats.forEach(function (m) { m.color.copy(fc); });
        if (!running) render();
      },
      isReady: function () { return ready; },
      destroy: function () { pause(); window.removeEventListener("resize", resize); renderer.dispose(); }
    };
  }

  window.initLongHall = initLongHall;
})();
