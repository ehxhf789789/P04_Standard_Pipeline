/**
 * Three.js Viewer for IFC Models
 * Handles 3D rendering, navigation, and element selection
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface ViewerOptions {
  container: HTMLElement;
  backgroundColor?: number;
  enableGrid?: boolean;
  enableAxes?: boolean;
}

export interface SelectionInfo {
  expressID: number;
  position: THREE.Vector3;
}

export type SelectionCallback = (info: SelectionInfo | null) => void;

export class ThreeViewer {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private meshes: Map<number, THREE.Mesh> = new Map();
  private selectedMesh: THREE.Mesh | null = null;
  private originalMaterial: THREE.Material | null = null;
  private onSelect: SelectionCallback | null = null;

  private animationId: number | null = null;

  // Materials
  private defaultMaterial: THREE.MeshPhongMaterial;
  private highlightMaterial: THREE.MeshPhongMaterial;
  private selectionMaterial: THREE.MeshPhongMaterial;

  constructor(options: ViewerOptions) {
    this.container = options.container;

    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(options.backgroundColor ?? 0xf0f0f0);

    // Initialize camera
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
    this.camera.position.set(50, 50, 50);
    this.camera.lookAt(0, 0, 0);

    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Initialize controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = true;  // Enable screen-space panning
    this.controls.minDistance = 1;
    this.controls.maxDistance = 1000;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.enableRotate = true;
    this.controls.panSpeed = 1.0;
    this.controls.rotateSpeed = 1.0;
    this.controls.zoomSpeed = 1.2;

    // Initialize raycaster for picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Create materials
    this.defaultMaterial = new THREE.MeshPhongMaterial({
      color: 0xc0c0c0,
      side: THREE.DoubleSide,
    });
    this.highlightMaterial = new THREE.MeshPhongMaterial({
      color: 0x4f46e5,
      side: THREE.DoubleSide,
      opacity: 0.9,
      transparent: true,
    });
    this.selectionMaterial = new THREE.MeshPhongMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
    });

    // Add lights
    this.setupLights();

    // Add grid and axes if enabled
    if (options.enableGrid !== false) {
      this.addGrid();
    }
    if (options.enableAxes !== false) {
      this.addAxes();
    }

    // Event listeners
    this.setupEventListeners();

    // Start render loop
    this.animate();
  }

  private setupLights(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    this.scene.add(directionalLight);

    // Hemisphere light for natural lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    hemisphereLight.position.set(0, 100, 0);
    this.scene.add(hemisphereLight);
  }

  private addGrid(): void {
    const gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0xcccccc);
    gridHelper.position.y = -0.01;
    this.scene.add(gridHelper);
  }

  private addAxes(): void {
    const axesHelper = new THREE.AxesHelper(10);
    this.scene.add(axesHelper);
  }

  private setupEventListeners(): void {
    // Resize handler
    window.addEventListener("resize", this.handleResize);

    // Mouse events for selection
    this.renderer.domElement.addEventListener("click", this.handleClick);
    this.renderer.domElement.addEventListener("mousemove", this.handleMouseMove);
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleClick = (event: MouseEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const meshArray = Array.from(this.meshes.values());
    const intersects = this.raycaster.intersectObjects(meshArray);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      this.selectMesh(mesh);

      // Find expressID
      let expressID: number | undefined;
      this.meshes.forEach((m, id) => {
        if (m === mesh) expressID = id;
      });

      if (expressID !== undefined && this.onSelect) {
        this.onSelect({
          expressID,
          position: intersects[0].point,
        });
      }
    } else {
      this.clearSelection();
      if (this.onSelect) {
        this.onSelect(null);
      }
    }
  };

  private handleMouseMove = (event: MouseEvent): void => {
    // Could implement hover highlight here
  };

  private selectMesh(mesh: THREE.Mesh): void {
    // Clear previous selection
    if (this.selectedMesh && this.originalMaterial) {
      this.selectedMesh.material = this.originalMaterial;
    }

    // Set new selection
    this.selectedMesh = mesh;
    this.originalMaterial = mesh.material as THREE.Material;
    mesh.material = this.selectionMaterial;
  }

  private clearSelection(): void {
    if (this.selectedMesh && this.originalMaterial) {
      this.selectedMesh.material = this.originalMaterial;
      this.selectedMesh = null;
      this.originalMaterial = null;
    }
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // Public API

  addMesh(
    expressID: number,
    vertices: Float32Array,
    indices: Uint32Array,
    color?: number,
    flatTransformation?: number[]
  ): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();

    // Vertices come as [x, y, z, nx, ny, nz] per vertex
    const positions: number[] = [];
    const normals: number[] = [];

    for (let i = 0; i < vertices.length; i += 6) {
      positions.push(vertices[i], vertices[i + 1], vertices[i + 2]);
      normals.push(vertices[i + 3], vertices[i + 4], vertices[i + 5]);
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(Array.from(indices));
    geometry.computeBoundingBox();

    const material = color
      ? new THREE.MeshPhongMaterial({ color, side: THREE.DoubleSide })
      : this.defaultMaterial;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Apply transformation matrix if provided
    if (flatTransformation && flatTransformation.length === 16) {
      const matrix = new THREE.Matrix4();
      matrix.fromArray(flatTransformation);
      mesh.applyMatrix4(matrix);
    }

    this.scene.add(mesh);
    this.meshes.set(expressID, mesh);

    return mesh;
  }

  removeMesh(expressID: number): void {
    const mesh = this.meshes.get(expressID);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.meshes.delete(expressID);
    }
  }

  setMeshVisibility(expressID: number, visible: boolean): void {
    const mesh = this.meshes.get(expressID);
    if (mesh) {
      mesh.visible = visible;
    }
  }

  setMeshColor(expressID: number, color: number): void {
    const mesh = this.meshes.get(expressID);
    if (mesh) {
      (mesh.material as THREE.MeshPhongMaterial).color.setHex(color);
    }
  }

  selectElement(expressID: number): void {
    const mesh = this.meshes.get(expressID);
    if (mesh) {
      this.selectMesh(mesh);
    }
  }

  fitToView(): void {
    if (this.meshes.size === 0) return;

    const box = new THREE.Box3();
    this.meshes.forEach((mesh) => {
      box.expandByObject(mesh);
    });

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = this.camera.fov * (Math.PI / 180);
    const cameraDistance = maxDim / (2 * Math.tan(fov / 2));

    this.camera.position.set(
      center.x + cameraDistance,
      center.y + cameraDistance,
      center.z + cameraDistance
    );
    this.camera.lookAt(center);
    this.controls.target.copy(center);
  }

  resetView(): void {
    this.camera.position.set(50, 50, 50);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
  }

  zoomIn(): void {
    this.camera.position.multiplyScalar(0.8);
    this.controls.update();
  }

  zoomOut(): void {
    this.camera.position.multiplyScalar(1.25);
    this.controls.update();
  }

  setBackgroundColor(color: number): void {
    this.scene.background = new THREE.Color(color);
  }

  onElementSelect(callback: SelectionCallback): void {
    this.onSelect = callback;
  }

  dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    window.removeEventListener("resize", this.handleResize);
    this.renderer.domElement.removeEventListener("click", this.handleClick);
    this.renderer.domElement.removeEventListener("mousemove", this.handleMouseMove);

    // Dispose meshes
    this.meshes.forEach((mesh) => {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    });
    this.meshes.clear();

    // Dispose materials
    this.defaultMaterial.dispose();
    this.highlightMaterial.dispose();
    this.selectionMaterial.dispose();

    // Dispose renderer
    this.renderer.dispose();

    // Remove canvas
    this.container.removeChild(this.renderer.domElement);

    this.controls.dispose();
  }
}

export default ThreeViewer;
