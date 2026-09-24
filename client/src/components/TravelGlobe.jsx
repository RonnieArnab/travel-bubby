import { useEffect, useRef, useState } from "react";

// Three.js stays in a lazy chunk. The photographed Earth is also the no-WebGL fallback.
export default function TravelGlobe() {
  const host = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
    ])
      .then(([THREE, { OrbitControls }]) => {
        if (disposed || !host.current) return;
        const container = host.current;
        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch {
          return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);
        renderer.domElement.setAttribute("aria-hidden", "true");
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(0, 0.4, 5.5);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableDamping = true;
        controls.autoRotateSpeed = 0.35;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        controls.autoRotate = !reduced.matches;
        const light = new THREE.DirectionalLight(0xfff5da, 3);
        light.position.set(-3, 5, 5);
        scene.add(light, new THREE.AmbientLight(0xffffff, 2));
        const world = new THREE.Group();
        world.rotation.set(0.1, -2.2, -0.16);
        scene.add(world);
        const texture = new THREE.TextureLoader().load(
          "/assets/earth.jpg",
          () => {
            if (!disposed) setReady(true);
          },
        );
        texture.colorSpace = THREE.SRGBColorSpace;
        const globe = new THREE.Mesh(
          new THREE.SphereGeometry(1.48, 64, 48),
          new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.85,
            metalness: 0,
            color: 0xdbe9d4,
          }),
        );
        world.add(globe);
        const point = (lat, lng, r = 1.5) => {
          const phi = ((90 - lat) * Math.PI) / 180;
          const theta = ((lng + 180) * Math.PI) / 180;
          return new THREE.Vector3(
            -r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta),
          );
        };
        const destinations = [
          [35.68, 139.69],
          [13.75, 100.5],
          [-8.4, 115.2],
          [48.85, 2.35],
          [40.7, -74],
        ];
        destinations.forEach(([lat, lng]) => {
          const pos = point(lat, lng);
          const pin = new THREE.Mesh(
            new THREE.SphereGeometry(0.047, 16, 16),
            new THREE.MeshStandardMaterial({
              color: 0xffbb76,
              emissive: 0x914222,
              emissiveIntensity: 0.35,
            }),
          );
          pin.position.copy(pos);
          world.add(pin);
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.085, 0.009, 8, 32),
            new THREE.MeshBasicMaterial({ color: 0xffdfb5 }),
          );
          ring.position.copy(pos.clone().multiplyScalar(1.008));
          ring.lookAt(pos.clone().multiplyScalar(2));
          world.add(ring);
        });
        [
          [0, 1],
          [1, 2],
          [0, 3],
          [3, 4],
        ].forEach(([a, b]) => {
          const start = point(...destinations[a]);
          const end = point(...destinations[b]);
          const middle = start
            .clone()
            .add(end)
            .normalize()
            .multiplyScalar(2.15);
          const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(curve.getPoints(70)),
            new THREE.LineDashedMaterial({
              color: 0xffe1af,
              dashSize: 0.04,
              gapSize: 0.035,
              transparent: true,
              opacity: 0.85,
            }),
          );
          line.computeLineDistances();
          world.add(line);
        });
        const resize = () => {
          const { width, height } = container.getBoundingClientRect();
          renderer.setSize(width, height);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();
        let visible = true;
        const intersection = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
        });
        intersection.observe(container);
        const motionChange = () => {
          controls.autoRotate = !reduced.matches;
        };
        reduced.addEventListener("change", motionChange);
        renderer.setAnimationLoop(() => {
          if (!visible || document.hidden) return;
          controls.update();
          renderer.render(scene, camera);
        });
        cleanup = () => {
          renderer.setAnimationLoop(null);
          observer.disconnect();
          intersection.disconnect();
          reduced.removeEventListener("change", motionChange);
          controls.dispose();
          scene.traverse((obj) => {
            obj.geometry?.dispose();
            if (obj.material) obj.material.dispose();
          });
          texture.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {});
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);
  return (
    <div
      className="travel-globe"
      ref={host}
      role="img"
      aria-label="Interactive 3D Earth with travel routes. Drag to rotate."
    >
      {!ready && <div className="globe-fallback" />}
    </div>
  );
}
