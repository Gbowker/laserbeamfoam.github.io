import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";



var liggghts_or_laser_prop;

// Set up the scene
const scene = new THREE.Scene();

// Add a small sphere at the origin to show the origin point
const originGeometry = new THREE.SphereGeometry(0.08, 32, 32);
const originMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const originSphere = new THREE.Mesh(originGeometry, originMaterial);
originSphere.position.set(0, 0, 0);
// Flip the y and z axes of the origin
// scene.add(originSphere);

// Add axes helper to show the axes
// Create axes helper with flipped Y axis
const axesHelper = new THREE.AxesHelper(0.6);
axesHelper.scale.y = -1;
axesHelper.scale.z = -1;
const axisLength = 0.4;
// Move the axes up and back
axesHelper.position.set(-0.5, 0.5, 1);

var shift = [-0.1, -0.2, -0.2]; // Shift to align with the axes helper position

const xLabel = createAxisLabel(
  "X",
  "#ff0000",
  new THREE.Vector3(
    axisLength + 0.2 + shift[0],
    0.22 + shift[1],
    0 + shift[2]
  ).add(axesHelper.position)
);
const yLabel = createAxisLabel(
  "Y",
  "#00ff00",
  new THREE.Vector3(0 + shift[0], -axisLength + shift[1], 0 + shift[2]).add(
    axesHelper.position
  )
);
const zLabel = createAxisLabel(
  "Z",
  "#0000ff",
  new THREE.Vector3(
    0 + shift[0],
    0.22 + shift[1],
    -axisLength - 0.2 + shift[2]
  ).add(axesHelper.position)
);
scene.add(xLabel);
scene.add(yLabel);
scene.add(zLabel);

// Usage:
const thickAxes = createThickAxis(0.5, 0.01);
scene.add(thickAxes);

// Set the background to a solid color (e.g., white)
scene.background = new THREE.Color("rgb(42, 42, 42)");

// Add a grid helper to the scene
var gridHelper = new THREE.GridHelper(100, 200, 0x777700, 0x777777);
gridHelper.position.y = -1; // Align with shadow plane
scene.add(gridHelper);

// Add ambient light for general illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Lower intensity for more dramatic shadows
scene.add(ambientLight);

// Add a large plane to receive shadows
const shadowPlaneGeometry = new THREE.PlaneGeometry(20, 20);
const shadowPlaneMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
const shadowPlane = new THREE.Mesh(shadowPlaneGeometry, shadowPlaneMaterial);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -0.5;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// Add a strong directional light that casts big shadows
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048; // High-res shadow map
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
scene.add(directionalLight);

// Safely get values from DOM or use defaults if not present
var plate_width = parseFloat($("#plate_width").val()) || 1;
var plate_width_input = document.getElementById("plate_width");
var plate_height = parseFloat($("#plate_height").val()) || 1;
var plate_height_input = document.getElementById("plate_height");
var plate_length = parseFloat($("#plate_length").val()) || 1;
var plate_length_input = document.getElementById("plate_length");
var layer_thickness =
  (parseFloat($("#layer_thickness").val()) * 3.2) / 800 || 1;
var layer_thickness_input = document.getElementById("layer_thickness");

var domain_height = parseFloat($("#domain_height").val()) || 1;

// 4. Create Box Geometry
var width = (plate_width * 3.2) / 800; // x axis
var height = (plate_height * 3.2) / 800; // y axis
var length = (plate_length * 3.2) / 800; // z axis
var height_domain = (domain_height * 3.2) / 800; // z axis

const geometry = new THREE.BoxGeometry(width, height, length);

// 5. Create edges geometry and material
var edges = new THREE.EdgesGeometry(geometry);
var edgeMaterial = new THREE.LineBasicMaterial({
  color: 0x00ff00,
  linewidth: 2,
});
var plateEdgeLines = new THREE.LineSegments(edges, edgeMaterial);

// Position the box geometry so its corner is at the origin
geometry.translate(-width / 2, height / 2, -length / 2);
plateEdgeLines.position.set(width / 2, height / 2, -length / 2);

// 6. Add only the edges to the scene (no solid box)
scene.add(plateEdgeLines);

const powder_layer_geometry = new THREE.BoxGeometry(
  width,
  layer_thickness,
  length
);

// 5. Create edges geometry and material
const edges2 = new THREE.EdgesGeometry(powder_layer_geometry);
const edgeMaterial2 = new THREE.LineBasicMaterial({
  color: 0xff0000,
  linewidth: 2,
});
// Use the standard edge material for compatibility across browsers
powder_layer_geometry.translate(width / 2, layer_thickness / 2, -length / 2);
var powderEdgeLines = new THREE.LineSegments(edges2, edgeMaterial2);

powderEdgeLines.position.set(
  width / 2,
  height - 0.0001 + layer_thickness / 2,
  -length / 2
);

// 6. Add only the edges to the scene (no solid box)
scene.add(powderEdgeLines);

const domain_geometry = new THREE.BoxGeometry(width, height_domain, length);

// 5. Create edges geometry and material
const domain_edges = new THREE.EdgesGeometry(domain_geometry);
const domain_edge_material = new THREE.LineBasicMaterial({
  color: 0x3366ff,
  linewidth: 2,
});

// Use the standard edge material for compatibility across browsers
domain_geometry.translate(width / 2, height_domain, -length / 2);
var domain_edge_lines = new THREE.LineSegments(
  domain_edges,
  domain_edge_material
);

domain_edge_lines.position.set(width / 2, height_domain / 2, -length / 2);

scene.add(domain_edge_lines);

// Convert micrometers to scene units
var radius = scaleMicromToPx(25);
var cylinderHeight = scaleMicromToPx(200);
var cylinderGeometry = new THREE.CylinderGeometry(
  radius,
  radius,
  cylinderHeight,
  50
);
// Create a cylinder Material
const cylinderMaterial = new THREE.MeshStandardMaterial({
  color: 0x55ff55,
  opacity: 0.8,
  transparent: true,
});

const cylinderMaterial_end = new THREE.MeshStandardMaterial({
  color: 0xff2222,
  opacity: 0.5,
  transparent: true,
});

// By default, the origin of rotation for a THREE.Mesh (like cylinder) is its local (0,0,0) position.
// For CylinderGeometry, this is at the center of the cylinder along its height.
// If you want to rotate around the base (bottom) of the cylinder instead of the center,
// you need to shift the geometry so that the base is at y=0 (or whichever axis is "up" in your scene).

// Move the geometry so the base is at y=0 (instead of center at y=0)
// cylinderGeometry.translate(0, 0 , 0);

var cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
var cylinder_end = new THREE.Mesh(cylinderGeometry, cylinderMaterial_end);

var x = scaleMicromToPx($("#laser_pos_x").val());
var y = scaleMicromToPx(0);
var z = scaleMicromToPx($("#laser_pos_z").val());

var x_end = scaleMicromToPx($("#laser_pos_x_end").val());
var y_end = scaleMicromToPx(0);
var z_end = scaleMicromToPx($("#laser_pos_z_end").val());

cylinder.position.set(x, y + cylinderHeight / 2, -z); // y + height/2 to sit on ground
// cylinder.rotation.y = Math.PI / 2; // Align along Y axis
cylinder.position.set(x, y + cylinderHeight / 2, -z); // y + height/2 to sit on ground

cylinder_end.position.set(x_end, y + cylinderHeight / 2, -z_end); // y + height/2 to sit on ground
// cylinder_end.rotation.y = Math.PI / 2; // Align along Y axis
cylinder_end.position.set(x_end, y_end + cylinderHeight / 2, -z_end); // y + height/2 to sit on ground

scene.add(cylinder);
scene.add(cylinder_end);
// Remove or comment out controls.enableDamping and controls.dampingFactor if present
// Make sure OrbitControls is not set to "enableDamping" or "dampingFactor"
// This will prevent the camera from orbiting in a "curved" or smooth way
// If you want a fixed, orthogonal view, use an OrthographicCamera instead of PerspectiveCamera
// Example (replace PerspectiveCamera with OrthographicCamera if you want a flat, non-curved look):

import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";

// Set up the renderer and attach it to the document
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(814, 830);

const camera = new THREE.PerspectiveCamera();
camera.position.set(2.2, 2.5, 1);

document
  .getElementById("laser_position_window")
  .appendChild(renderer.domElement);
// document.getElementById("powder_bed").appendChild(renderer2.domElement);

$(renderer.domElement).attr("id", "laser_position_window_renderer_dom");

const controls = new OrbitControls(camera, renderer.domElement);

controls.target.set(0, -1, -2); // Set the controls' target to match
controls.update(); // Apply the target so OrbitControls uses it

// Enable camera panning (move x/y/z) on middle mouse button
controls.enablePan = true;
controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
$(document).ready(function () {
  // Enable shadow mapping in the renderer
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Create an STL loader
  const loader = new STLLoader();

  // Load and display the STL file in the same canvas
  loader.load("geometry/single_track_melted.stl", function (geometry) {
    // Create a material for the mesh
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      transparent: true,
      opacity: 0.9,
    });
    // Create a mesh from the geometry and material
    const mesh = new THREE.Mesh(geometry, material);
    // Optionally scale or position the mesh
    mesh.position.set(0, 0, 0);
    mesh.rotation.x = -Math.PI / 2;
    // mesh.rotation.z = Math.PI / 2;
    // mesh.rotation.y = -Math.PI / 10;
    mesh.scale.set(4000, 4000, 4000);
    // Add the mesh to the scene
    scene.add(mesh);
    // Optionally, store mesh reference for later use
    animate(); // Start animation after STL is loaded if needed
  });
});

$("#laser_pos_x").on("input", function () {
  cylinder.position.set(
    scaleMicromToPx($(this).val()),
    cylinder.position.y,
    cylinder.position.z
  );
});

$("#laser_pos_z").on("input", function () {
  cylinder.position.set(
    cylinder.position.x,
    cylinder.position.y,
    -scaleMicromToPx($(this).val())
  );
});

$("#laser_angle_yx").on("input", function () {
  var domain_height = scaleMicromToPx($("#domain_height").val());

  var x = scaleMicromToPx($("#laser_pos_x").val());
  var z = scaleMicromToPx($("#laser_pos_z").val());

  var x_end = scaleMicromToPx($("#laser_pos_x_end").val());
  var z_end = scaleMicromToPx($("#laser_pos_z_end").val());

  var cylinder_rot_yx = ($("#laser_angle_yx").val() * Math.PI) / 180;
  var cylinder_rot_yz = ($("#laser_angle_yz").val() * Math.PI) / 180;

  var radius = scaleMicromToPx($("#laser_rad").val());

  scene.remove(cylinder);
  cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinder.position.set(
    x + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yz))
  ); // y + height/2 to sit on ground
  cylinder.position.set(
    x + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yz))
  ); // y + height/2 to sit on ground
  cylinder.rotation.z = cylinder_rot_yx; // Align along Y axis
  cylinder.rotation.x = cylinder_rot_yz; // Align along Y axis
  scene.add(cylinder);

  scene.remove(cylinder_end);
  cylinder_end = new THREE.Mesh(cylinderGeometry, cylinderMaterial_end);
  cylinder_end.position.set(
    x_end + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z_end + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yx))
  ); // y + height/2 to sit on ground
  cylinder_end.position.set(
    x_end + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z_end + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yz))
  ); // y + height/2 to sit on ground
  cylinder_end.rotation.z = cylinder_rot_yx; // Align along Y axis
  cylinder_end.rotation.x = cylinder_rot_yz; // Align along Y axis
  scene.add(cylinder_end);
});

$("#laser_angle_yz").on("input", function () {
  var domain_height = scaleMicromToPx($("#domain_height").val());
  var x = scaleMicromToPx($("#laser_pos_x").val());
  var z = scaleMicromToPx($("#laser_pos_z").val());
  var x_end = scaleMicromToPx($("#laser_pos_x_end").val());
  var z_end = scaleMicromToPx($("#laser_pos_z_end").val());
  var cylinder_rot_yx = ($("#laser_angle_yx").val() * Math.PI) / 180;
  var cylinder_rot_yz = ($("#laser_angle_yz").val() * Math.PI) / 180;
  var radius = scaleMicromToPx($("#laser_rad").val());

  cylinderGeometry = new THREE.CylinderGeometry(
    radius,
    radius, // Convert micrometers to meters
    cylinderHeight,
    50
  );

  scene.remove(cylinder);
  cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinder.position.set(
    x + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yz))
  ); // y + height/2 to sit on ground
  cylinder.position.set(
    x + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yz))
  ); // y + height/2 to sit on ground
  cylinder.rotation.z = cylinder_rot_yx; // Align along Y axis
  cylinder.rotation.x = cylinder_rot_yz; // Align along Y axis
  scene.add(cylinder);

  scene.remove(cylinder_end);
  cylinder_end = new THREE.Mesh(cylinderGeometry, cylinderMaterial_end);
  cylinder_end.position.set(
    x_end + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z_end + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yx))
  ); // y + height/2 to sit on ground
  cylinder_end.position.set(
    x_end + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z_end + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yz))
  ); // y + height/2 to sit on ground
  cylinder_end.rotation.z = cylinder_rot_yx; // Align along Y axis
  cylinder_end.rotation.x = cylinder_rot_yz; // Align along Y axis
  scene.add(cylinder_end);
});

$("#laser_rad").on("input", function () {
  // Remove the old cylinder from the scene
  scene.remove(cylinder);

  // Get the new radius value and convert it
  var newRadius = scaleMicromToPx($(this).val());

  // Create new geometry with the updated radius
  const newCylinderGeometry = new THREE.CylinderGeometry(
    newRadius,
    newRadius,
    cylinder.geometry.parameters.height,
    50
  );

  // Create a new mesh with the same material
  const newCylinder = new THREE.Mesh(newCylinderGeometry, cylinder.material);

  // Set the position and rotation to match the old cylinder
  newCylinder.position.copy(cylinder.position);
  newCylinder.rotation.copy(cylinder.rotation);

  // Add the new cylinder to the scene
  scene.add(newCylinder);

  // Update the reference to the cylinder
  cylinder.geometry.dispose();
  cylinder.geometry = newCylinderGeometry;
  scene.remove(newCylinder); // Remove the duplicate
  scene.add(cylinder); // Add the updated cylinder back
  cylinder.scale.set(
    newRadius / cylinder.geometry.parameters.radiusTop,
    1,
    newRadius / cylinder.geometry.parameters.radiusBottom
  );
});

$(plate_width_input).on("input", function () {
  updateDisplay();
});

$(plate_height_input).on("input", function () {
  updateDisplay();
});

$(plate_length_input).on("input", function () {
  updateDisplay();
});

$(layer_thickness_input).on("input", function () {
  updateDisplay();
});

// ############################################  Functions   ######################################################
// Animation loop

function scaleMicromToPx(x) {
  // Convert micrometers to pixels (assuming 1 pixel = 3.2 micrometers)
  const scaleFactor = 3.2 / 800; // Adjust this factor based on your specific conversion needs
  return x * scaleFactor;
}

// Add axis labels (X, Y, Z)
function createAxisLabel(text, color, position) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "30px monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.4, 0.2, 1);
  sprite.position.copy(position);
  return sprite;
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

function createThickAxis(length = 5, radius = 0.05) {
  const group = new THREE.Group();

  const createAxis = (color, rotation, position) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
    const material = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.rotation.set(...rotation);
    mesh.position.set(...position);
    group.add(mesh);
  };

  var shift = [-0.1, -0.2, -0.2]; // Shift to align with the axes helper position

  // X axis - Red
  createAxis(
    0xff0000,
    [0, 0, Math.PI / 2],
    [-0.253 + shift[0], 0.75 + shift[1], 1 + shift[2]]
  );

  // Y axis - Green
  createAxis(
    0x00ff00,
    [0, 0, 0],
    [-0.5 + shift[0], 0.5 + shift[1], 1 + shift[2]]
  );

  // Z axis - Blue
  createAxis(
    0x0000ff,
    [Math.PI / 2, 0, 0],
    [-0.5 + shift[0], 0.75 + shift[1], 0.75 + shift[2]]
  );

  return group;
}

function updateDisplay() {
  var width = scaleMicromToPx($("#plate_width").val());
  var length = scaleMicromToPx($("#plate_length").val());
  var height = scaleMicromToPx($("#plate_height").val());
  var layer_thickness = scaleMicromToPx($("#layer_thickness").val());
  var domain_height = scaleMicromToPx($("#domain_height").val());
  var radius = scaleMicromToPx($("#laser_rad").val());

  var x = scaleMicromToPx($("#laser_pos_x").val());
  var z = scaleMicromToPx($("#laser_pos_z").val());

  var x_end = scaleMicromToPx($("#laser_pos_x_end").val());
  var z_end = scaleMicromToPx($("#laser_pos_z_end").val());

  var cylinder_rot_yx = ($("#laser_angle_yx").val() * Math.PI) / 180;
  var cylinder_rot_yz = ($("#laser_angle_yz").val() * Math.PI) / 180;
  //  ----------------------------------------------------------------------------

  // Remove old plateEdgeLines from scene
  scene.remove(plateEdgeLines);

  // Create new geometry with updated width
  const newGeometry = new THREE.BoxGeometry(width, height, length);
  newGeometry.translate(width / 2, height / 2, -length / 2);

  // Create new edges and plateEdgeLines
  var edges = new THREE.EdgesGeometry(newGeometry);
  plateEdgeLines = new THREE.LineSegments(edges, edgeMaterial);
  scene.add(plateEdgeLines);

  //  ----------------------------------------------------------------------------

  scene.remove(powderEdgeLines);

  const newGeometry_powder = new THREE.BoxGeometry(
    width,
    layer_thickness,
    length
  );
  var powder_edges = new THREE.EdgesGeometry(newGeometry_powder);
  powderEdgeLines = new THREE.LineSegments(powder_edges, edgeMaterial2);

  powderEdgeLines.position.set(
    width / 2,
    height - 0.0001 + layer_thickness / 2,
    -length / 2
  );

  scene.add(powderEdgeLines);

  //  ----------------------------------------------------------------------------

  scene.remove(domain_edge_lines);

  const domain_geometry = new THREE.BoxGeometry(width, domain_height, length);

  // 5. Create edges geometry and material
  var domain_edges = new THREE.EdgesGeometry(domain_geometry);

  // Use the standard edge material for compatibility across browsers
  domain_geometry.translate(width / 2, domain_height, -length / 2);
  domain_edge_lines = new THREE.LineSegments(
    domain_edges,
    domain_edge_material
  );

  domain_edge_lines.position.set(width / 2, domain_height / 2, -length / 2);

  scene.add(domain_edge_lines);
  //  ----------------------------------------------------------------------------

  // Convert micrometers to scene units
  // cylinderHeight = domain_height*2/(Math.cos(cylinder_rot_yz)+Math.cos(cylinder_rot_yx)); // Adjust height based on angle
  cylinderHeight = domain_height; // Adjust height based on angle
  cylinderGeometry = new THREE.CylinderGeometry(
    radius,
    radius, // Convert micrometers to meters
    cylinderHeight,
    50
  );

  scene.remove(cylinder);
  cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinder.position.set(
    x + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yz))
  ); // y + height/2 to sit on ground
  cylinder.position.set(
    x + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yz))
  ); // y + height/2 to sit on ground
  cylinder.rotation.z = cylinder_rot_yx; // Align along Y axis
  cylinder.rotation.x = cylinder_rot_yz; // Align along Y axis
  scene.add(cylinder);

  scene.remove(cylinder_end);
  cylinder_end = new THREE.Mesh(cylinderGeometry, cylinderMaterial_end);
  cylinder_end.position.set(
    x_end + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z_end + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yx))
  ); // y + height/2 to sit on ground
  cylinder_end.position.set(
    x_end + (domain_height * Math.sin(cylinder_rot_yx)) / 2,
    y + cylinderHeight / 2,
    -(z_end + (y + cylinderHeight / 2) * Math.sin(cylinder_rot_yz))
  ); // y + height/2 to sit on ground
  cylinder_end.rotation.z = cylinder_rot_yx; // Align along Y axis
  cylinder_end.rotation.x = cylinder_rot_yz; // Align along Y axis
  scene.add(cylinder_end);
}

$(function () {
  let interval;

  function holdButton($btn, direction, input) {
    const start = () => {
      if (direction === "up") input.stepUp();
      else input.stepDown();
      updateDisplay();

      interval = setInterval(() => {
        if (direction === "up") input.stepUp();
        else input.stepDown();
        updateDisplay();
      }, 90); // adjust speed here

      // Cancel interval on mouseup/mouseleave/touchend/touchcancel
      const cancelEvents = "mouseup mouseleave touchend touchcancel";
      $btn.on(cancelEvents, () => clearInterval(interval));
    };

    const stop = () => clearInterval(interval);

    $btn
      .on("mousedown touchstart", start)
      .on("mouseup mouseleave touchend touchcancel", stop);
  }

  holdButton(
    $("#plate_width_plus"),
    "up",
    document.getElementById("plate_width")
  );
  holdButton(
    $("#plate_width_minus"),
    "down",
    document.getElementById("plate_width")
  );

  holdButton(
    $("#plate_height_plus"),
    "up",
    document.getElementById("plate_height")
  );
  holdButton(
    $("#plate_height_minus"),
    "down",
    document.getElementById("plate_height")
  );

  holdButton(
    $("#plate_length_plus"),
    "up",
    document.getElementById("plate_length")
  );
  holdButton(
    $("#plate_length_minus"),
    "down",
    document.getElementById("plate_length")
  );

  holdButton(
    $("#layer_thickness_plus"),
    "up",
    document.getElementById("layer_thickness")
  );
  holdButton(
    $("#layer_thickness_minus"),
    "down",
    document.getElementById("layer_thickness")
  );

  holdButton(
    $("#domain_height_plus"),
    "up",
    document.getElementById("domain_height")
  );
  holdButton(
    $("#domain_height_minus"),
    "down",
    document.getElementById("domain_height")
  );

  holdButton(
    $("#laser_radius_plus"),
    "up",
    document.getElementById("laser_rad")
  );
  holdButton(
    $("#laser_radius_minus"),
    "down",
    document.getElementById("laser_rad")
  );

  holdButton(
    $("#laser_position_x_plus"),
    "up",
    document.getElementById("laser_pos_x")
  );
  holdButton(
    $("#laser_position_x_minus"),
    "down",
    document.getElementById("laser_pos_x")
  );

  holdButton(
    $("#laser_position_z_plus"),
    "up",
    document.getElementById("laser_pos_z")
  );
  holdButton(
    $("#laser_position_z_minus"),
    "down",
    document.getElementById("laser_pos_z")
  );

  holdButton(
    $("#laser_position_x_end_plus"),
    "up",
    document.getElementById("laser_pos_x_end")
  );
  holdButton(
    $("#laser_position_x_end_minus"),
    "down",
    document.getElementById("laser_pos_x_end")
  );

  holdButton(
    $("#laser_position_z_end_plus"),
    "up",
    document.getElementById("laser_pos_z_end")
  );
  holdButton(
    $("#laser_position_z_end_minus"),
    "down",
    document.getElementById("laser_pos_z_end")
  );

  holdButton(
    $("#laser_angle_yz_plus"),
    "up",
    document.getElementById("laser_angle_yz")
  );
  holdButton(
    $("#laser_angle_yz_minus"),
    "down",
    document.getElementById("laser_angle_yz")
  );

  holdButton(
    $("#laser_angle_yx_plus"),
    "up",
    document.getElementById("laser_angle_yx")
  );
  holdButton(
    $("#laser_angle_yx_minus"),
    "down",
    document.getElementById("laser_angle_yx")
  );
});

document
  .getElementById("download_liggghts_input_button")
  .addEventListener("click", async () => {
    const zip = new JSZip();

    var liggghts_input = `# Trial run of Powder loading

atom_style		granular
atom_modify		map	array
boundary		m	m	m
newton			off

communicate		single vel yes

units 			cgs

region			domain block 0.0 ${parseFloat($("#plate_width").val()) / 10000} 0.0 ${
      parseFloat($("#plate_length").val()) / 10000
    } 0.0 ${
      ((parseFloat($("#plate_height").val()) +
        parseFloat($("#layer_thickness").val())) *
        3.33) /
      10000
    } units box

create_box		1 domain

neighbor		0.008101 bin
neigh_modify	delay 1

### Setup

# Material and Interaction Properties
fix 		m1 all property/global youngsModulus peratomtype 5e7
fix 		m2 all property/global poissonsRatio peratomtype 0.45
fix 		m3 all property/global coefficientRestitution peratomtypepair 1 0.1
fix 		m4 all property/global coefficientFriction peratomtypepair 1 0.065

# New pair style
pair_style gran model hertz tangential history #Hertzian without cohesion
pair_coeff	* *

# Integrator
fix			integrate all nve/sphere

# Time step
timestep	0.00000005

# Gravity
fix		grav all gravity 981 vector 0.0 0.0 -1.0

# Particle Insertion
fix				pts1 all particletemplate/sphere 15485863 atom_type 1 density constant 4.43 &
				radius constant 0.0004625
fix				pts2 all particletemplate/sphere 154849 atom_type 1 density constant 4.43 &
				radius constant 0.000525
fix				pts3 all particletemplate/sphere 49979687 atom_type 1 density constant 4.43 &
				radius constant 0.0005965
fix				pts4 all particletemplate/sphere 15485867 atom_type 1 density constant 4.43 &
				radius constant 0.000678
fix				pts5 all particletemplate/sphere 32452843 atom_type 1 density constant 4.43 &
				radius constant 0.0007705	
fix				pts6 all particletemplate/sphere 32452867 atom_type 1 density constant 4.43 &
				radius constant 0.0008755	
fix				pts7 all particletemplate/sphere 67867979 atom_type 1 density constant 4.43 &
				radius constant 0.0009945
fix				pts8 all particletemplate/sphere 86028121 atom_type 1 density constant 4.43 &
				radius constant 0.0011301
fix				pts9 all particletemplate/sphere 16193 atom_type 1 density constant 4.43 &
				radius constant 0.001284
fix				pts10 all particletemplate/sphere 17167 atom_type 1 density constant 4.43 &
				radius constant 0.00145885
fix				pts11 all particletemplate/sphere 16981 atom_type 1 density constant 4.43 &
				radius constant 0.0016575
fix				pts12 all particletemplate/sphere 17609 atom_type 1 density constant 4.43 &
				radius constant 0.00188315
fix				pts13 all particletemplate/sphere 67867967 atom_type 1 density constant 4.43 &
				radius constant 0.0021395
fix				pts14 all particletemplate/sphere 49979693 atom_type 1 density constant 4.43 &
				radius constant 0.0024309			
fix				pts15 all particletemplate/sphere 31891 atom_type 1 density constant 4.43 &
				radius constant 0.002762	
fix				pts16 all particletemplate/sphere 31223 atom_type 1 density constant 4.43 &
				radius constant 0.003138	
fix				pts17 all particletemplate/sphere 27191 atom_type 1 density constant 4.43 &
				radius constant 0.00356531	
fix				pts18 all particletemplate/sphere 27751 atom_type 1 density constant 4.43 &
				radius constant 0.0040505	

fix 				pdd all particledistribution/discrete 78593 18 pts1 1.97883E-06 pts2 0.000158863 pts3 0.002123547 pts4 0.009419927 &
				pts5 0.024542522 pts6 0.047522205 pts7 0.07564377 pts8 0.103955961 pts9 0.126582204 pts10 0.138350101 pts11 0.136320196 &
				pts12 0.120736947 pts13 0.095077524 pts14 0.065101351 pts15 0.037187843 pts16 0.015932988 pts17 0.001336914 pts18 5.1597E-06


region 				factory block 0.0 0.01 0.0 0.015 0.02 0.1 units box
fix 				ins all insert/rate/region seed 51869 distributiontemplate pdd &
				nparticles 240 particlerate 200000 insert_every 5 &
				overlapcheck yes vel constant 0. 0. 0.0 region factory ntry_mc 10000
				
			
# Boundary
fix box all mesh/surface file meshes/domain.stl type 1 scale 0.1 curvature 1e-5
fix plate all mesh/surface file meshes/plate.stl type 1 scale 0.1 curvature 1e-5
fix wall all wall/gran model hertz tangential history mesh n_meshes 2  meshes box plate

variable x1 atom x*0.01
variable y1 atom y*0.01
variable z1 atom z*0.01

compute 1 all property/atom radius
variable rad1 atom "c_1*0.01"

# Check time step and initialize dump file
#fix ctg all check/timestep/gran 1 0.01 0.01
run 1
#unfix ctg

#insert the first particles so that dump is not empty
dump		dmp all custom/vtk 7500 post/trial_*.vtk id type type x y z ix iy iz vx vy vz fx fy fz omegax omegay omegaz radius
dump		mydump all custom 750000 post/location v_x1 v_y1 v_z1 v_rad1
dump		mydump2 all custom 750000 post/parDist.xls v_rad1

run			500000 upto

compute         2 all reduce sum c_1
thermo_style    custom step c_2
run             0
variable        co atom "z+c_1 > ${
      (parseFloat($("#plate_height").val()) +
        parseFloat($("#layer_thickness").val())) /
      10000
    }"
group           layer variable co


delete_atoms group layer compress yes

# Initial stage
run			750000 upto

`;

    var bedPlateDict = `/*--------------------------------*- C++ -*----------------------------------*
| =========                 |                                                |
| \\      /  F ield         | foam-extend: Open Source CFD                    |
|  \\    /   O peration     | Version:     4.0                                |
|   \\  /    A nd           | Web:         http://www.foam-extend.org         |
|    \\/     M anipulation  |                                                 |
\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      bedPlateDict;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

Bed true;

xmin 0.0;
xmax ${parseFloat($("#plate_width").val()) / 1000000};

ymin 0.0;
ymax ${parseFloat($("#plate_length").val()) / 1000000};

zmin 0.0;
zmax ${parseFloat($("#plate_height").val()) / 1000000};

// ************************************************************************* //`;

    // Create a mesh from the box geometry (not the edges)
    // Plate geometry
    const export_geometry_box = new THREE.BoxGeometry(
      parseFloat($("#plate_width").val()),
      parseFloat($("#plate_height").val()),
      parseFloat($("#plate_length").val())
    );

    // Move so that the minimum corner is at (0,0,0)
    export_geometry_box.translate(
      parseFloat($("#plate_width").val()) / 2,
      parseFloat($("#plate_height").val()) / 2,
      parseFloat($("#plate_length").val()) / 2
    );

    // Domain geometry
    const export_geometry_domain = new THREE.BoxGeometry(
      parseFloat($("#plate_width").val()),
      (parseFloat($("#plate_height").val()) +
        parseFloat($("#layer_thickness").val())) *
        3.33,
      parseFloat($("#plate_length").val())
    );
    // Move so that the minimum corner is at (0,0,0)
    export_geometry_domain.translate(
      parseFloat($("#plate_width").val()) / 2,
      ((parseFloat($("#plate_height").val()) +
        parseFloat($("#layer_thickness").val())) *
        3.33) /
        2,
      parseFloat($("#plate_length").val()) / 2
    );

    const export_mesh_box = new THREE.Mesh(
      export_geometry_box,
      new THREE.MeshBasicMaterial()
    );
    const export_mesh_domain = new THREE.Mesh(
      export_geometry_domain,
      new THREE.MeshBasicMaterial()
    );

    const exporter = new STLExporter();
    const stl_string_box = exporter.parse(export_mesh_box);
    const stl_string_domain = exporter.parse(export_mesh_domain);

    // Simulate folder and files
    zip.folder("DEM_liggghts_case").file("mesh/plate.stl", stl_string_box);
    zip.folder("DEM_liggghts_case").file("mesh/domain.stl", stl_string_domain);
    zip.folder("DEM_liggghts_case").file("input.liggghts", liggghts_input);
    zip
      .folder("DEM_liggghts_case")
      .file("OpenFOAM/system/bedPlateDict", bedPlateDict);
    // Create zip file
    const blob = await zip.generateAsync({ type: "blob" });

    // Trigger download
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "DEM_liggghts_case.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });




function generateLiggghtsInput(width, height, length, layer_thickness) {

  var liggghts_input = `# Trial run of Powder loading

atom_style		granular
atom_modify		map	array
boundary		m	m	m
newton			off

communicate		single vel yes

units 			cgs

region			domain block 0.0 ${width} 0.0 ${length} 0.0 ${height} units box

create_box		1 domain

neighbor		0.008101 bin
neigh_modify	delay 1

### Setup

# Material and Interaction Properties
fix 		m1 all property/global youngsModulus peratomtype 5e7
fix 		m2 all property/global poissonsRatio peratomtype 0.45
fix 		m3 all property/global coefficientRestitution peratomtypepair 1 0.1
fix 		m4 all property/global coefficientFriction peratomtypepair 1 0.065

# New pair style
pair_style gran model hertz tangential history #Hertzian without cohesion
pair_coeff	* *

# Integrator
fix			integrate all nve/sphere

# Time step
timestep	0.00000005

# Gravity
fix		grav all gravity 981 vector 0.0 0.0 -1.0

# Particle Insertion
fix				pts1 all particletemplate/sphere 15485863 atom_type 1 density constant 4.43 &
				radius constant 0.0004625
fix				pts2 all particletemplate/sphere 154849 atom_type 1 density constant 4.43 &
				radius constant 0.000525
fix				pts3 all particletemplate/sphere 49979687 atom_type 1 density constant 4.43 &
				radius constant 0.0005965
fix				pts4 all particletemplate/sphere 15485867 atom_type 1 density constant 4.43 &
				radius constant 0.000678
fix				pts5 all particletemplate/sphere 32452843 atom_type 1 density constant 4.43 &
				radius constant 0.0007705	
fix				pts6 all particletemplate/sphere 32452867 atom_type 1 density constant 4.43 &
				radius constant 0.0008755	
fix				pts7 all particletemplate/sphere 67867979 atom_type 1 density constant 4.43 &
				radius constant 0.0009945
fix				pts8 all particletemplate/sphere 86028121 atom_type 1 density constant 4.43 &
				radius constant 0.0011301
fix				pts9 all particletemplate/sphere 16193 atom_type 1 density constant 4.43 &
				radius constant 0.001284
fix				pts10 all particletemplate/sphere 17167 atom_type 1 density constant 4.43 &
				radius constant 0.00145885
fix				pts11 all particletemplate/sphere 16981 atom_type 1 density constant 4.43 &
				radius constant 0.0016575
fix				pts12 all particletemplate/sphere 17609 atom_type 1 density constant 4.43 &
				radius constant 0.00188315
fix				pts13 all particletemplate/sphere 67867967 atom_type 1 density constant 4.43 &
				radius constant 0.0021395
fix				pts14 all particletemplate/sphere 49979693 atom_type 1 density constant 4.43 &
				radius constant 0.0024309			
fix				pts15 all particletemplate/sphere 31891 atom_type 1 density constant 4.43 &
				radius constant 0.002762	
fix				pts16 all particletemplate/sphere 31223 atom_type 1 density constant 4.43 &
				radius constant 0.003138	
fix				pts17 all particletemplate/sphere 27191 atom_type 1 density constant 4.43 &
				radius constant 0.00356531	
fix				pts18 all particletemplate/sphere 27751 atom_type 1 density constant 4.43 &
				radius constant 0.0040505	

fix 				pdd all particledistribution/discrete 78593 18 pts1 1.97883E-06 pts2 0.000158863 pts3 0.002123547 pts4 0.009419927 &
				pts5 0.024542522 pts6 0.047522205 pts7 0.07564377 pts8 0.103955961 pts9 0.126582204 pts10 0.138350101 pts11 0.136320196 &
				pts12 0.120736947 pts13 0.095077524 pts14 0.065101351 pts15 0.037187843 pts16 0.015932988 pts17 0.001336914 pts18 5.1597E-06


region 				factory block 0.0 0.01 0.0 0.015 0.02 0.1 units box
fix 				ins all insert/rate/region seed 51869 distributiontemplate pdd &
				nparticles 240 particlerate 200000 insert_every 5 &
				overlapcheck yes vel constant 0. 0. 0.0 region factory ntry_mc 10000
				
			
# Boundary
fix box all mesh/surface file meshes/domain.stl type 1 scale 0.1 curvature 1e-5
fix plate all mesh/surface file meshes/plate.stl type 1 scale 0.1 curvature 1e-5
fix wall all wall/gran model hertz tangential history mesh n_meshes 2  meshes box plate

variable x1 atom x*0.01
variable y1 atom y*0.01
variable z1 atom z*0.01

compute 1 all property/atom radius
variable rad1 atom "c_1*0.01"

# Check time step and initialize dump file
#fix ctg all check/timestep/gran 1 0.01 0.01
run 1
#unfix ctg

#insert the first particles so that dump is not empty
dump		dmp all custom/vtk 7500 post/trial_*.vtk id type type x y z ix iy iz vx vy vz fx fy fz omegax omegay omegaz radius
dump		mydump all custom 750000 post/location v_x1 v_y1 v_z1 v_rad1
dump		mydump2 all custom 750000 post/parDist.xls v_rad1

run			500000 upto

compute         2 all reduce sum c_1
thermo_style    custom step c_2
run             0
variable        co atom "z+c_1 > ${height + layer_thickness}"
group           layer variable co


delete_atoms group layer compress yes

# Initial stage
run			750000 upto

`;

  return liggghts_input;
}

function generateBedPlateDict() {

  var width = parseFloat($("#plate_width").val()) / 1000000;
  var height = parseFloat($("#plate_height").val()) / 1000000;
  var length = parseFloat($("#plate_length").val()) / 1000000;

  var bedPlateDict = `/*--------------------------------*- C++ -*----------------------------------*
| =========                |                                                 |
| \\      /  F ield         | foam-extend: Open Source CFD                    |
|  \\    /   O peration     | Version:     4.0                                |
|   \\  /    A nd           | Web:         http://www.foam-extend.org         |
|    \\/     M anipulation  |                                                 |
\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      bedPlateDict;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

Bed true;

xmin 0.0;
xmax ${width};

ymin 0.0;
ymax ${length};

zmin 0.0;
zmax ${height};

// ************************************************************************* //`;

  return bedPlateDict;
}

$("#close_div").on("click", function () {
  $("#info_div").addClass("hidden");
  $("#info_div").removeClass("revealed");
  $("#info_div_content").addClass("hidden");
  $("#info_div_content").removeClass("revealed");
});

$("#light_theme").on("click", function () {
  $("#light_theme").addClass("active_theme");
  $("#dark_theme").removeClass("active_theme");
  $("body").css("background", "#d8d8d8");
  $("body").css("transition", "background 0.4s");
  scene.background = new THREE.Color("rgb(255, 255, 255)");
});

$("#dark_theme").on("click", function () {
  $("#light_theme").removeClass("active_theme");
  $("#dark_theme").addClass("active_theme");
  $("body").css("background", "#4b4b4b");
  $("body").css("transition", "background 0.4s");
  scene.background = new THREE.Color("rgb(42, 42, 42)");
});

$("#copy_div").on("click", function () {
  const textarea = document.getElementById("info_div_input");
  const text = textarea.value;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      // alert("Text copied to clipboard!");
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
    });
});


function generateLaserPropInputFiles() {

var radius = $("#laser_rad").val();


  var laser_prop_input = `/*--------------------------------*- C++ -*----------------------------------*
  \=========                 |
  \\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox
   \\    /   O peration     | Website:  https://openfoam.org
    \\  /    A nd           | Version:  6
     \\/     M anipulation  |
\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "constant";
    object      PhaseFieldProperties;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
V_incident	(0 1 0);//(0 1 0);//NORMALISED IN CODE

timeVsLaserPosition
{
    file    "$FOAM_CASE/constant/timeVsLaserPosition";
    outOfBounds clamp;
}

timeVsLaserPower
{
    file    "$FOAM_CASE/constant/timeVsLaserPower";
    outOfBounds clamp;
}

laserRadius ${radius}e-6;

N_sub_divisions	1;

wavelength	1.064e-6;
e_num_density	5.83e29;

Radius_Flavour	2.0;

PowderSim true;

// HS_a 0.000025;
// HS_bg 0.0;//20
// HS_lg 0.000125;
// HS_velocity 1.0;//6.0;

// HS_Q 150.0;//

// N_sub_divisions	1;

// //For linear path set oscAmpX=oscAmpz=0
// //For sine path set oscAmpz=0
// //For circular path set amplitude and frequency in both X and Z
// HS_oscAmpX 0.0;
// HS_oscAmpZ 0.0;

// HS_oscFreqX 180;
// HS_oscFreqZ 180;

// wavelength	1.064e-6;
// e_num_density	5.83e29;
// elec_resistivity	1.0e-6;

// Radius_Flavour	3.0;
`


  return laser_prop_input;
}


function generateTimeVsLaserPosition() {

  var x = parseInt($("#laser_pos_x").val());
  var z = parseInt($("#laser_pos_z").val());
  var x_end= parseInt($("#laser_pos_x_end").val());
  var z_end= parseInt($("#laser_pos_z_end").val());
  
  var timeVsLaserPosition = `(
  (0          (${x}e-6  20e-6  ${z}e-6))
  (600e-6     (${x_end}e-6  20e-6  ${z_end}e-6))
  (1000e-6    (${x_end}e-6  20e-6  ${z_end}e-6))
)`

  return timeVsLaserPosition;
}

function generateTimeVsLaserPower() {

  var laserPower = parseInt($("#laser_power").val());
  var timeVsLaserPower = `(
  (0                 0)
  (1e-8             ${laserPower})
  (600e-6           ${laserPower})
  (600.001e-6       0  )
  (1000e-6          0  )
)`

  return timeVsLaserPower;
}


$("#show_liggghts_input_file").on("click", function () {

    $("#info_div_title_3").addClass("hidden");

    liggghts_or_laser_prop = "liggghts";

    $("#info_div").removeClass("hidden");
    $("#info_div").addClass("revealed");

    $("#info_div_content").removeClass("hidden");
    $("#info_div_content").addClass("revealed");
    
    $("#info_div_title_1").text("LIGGGHTS Input File");
    $("#info_div_title_2").text("bedPlateDict");

    $("#info_div_title_1").addClass("info_div_active");
    $("#info_div_title_2").removeClass("info_div_active");

  $("#info_div_input").val(
    generateLiggghtsInput(
      parseFloat($("#plate_width").val()) / 10000,
      parseFloat(
        $("#plate_height").val() / 10000,
        parseFloat($("#plate_length").val()) / 10000,
        parseFloat($("#layer_thickness").val()) / 10000
      )
    )
  );
      
});


$("#show_laser_prop_input_files").on("click", function () {

  liggghts_or_laser_prop = "laser_prop";

  $("#info_div_title_3").removeClass("hidden");
  $("#info_div").removeClass("hidden");
  $("#info_div").addClass("revealed");
  $("#info_div_content").removeClass("hidden");
  $("#info_div_content").addClass("revealed");
  $("#info_div_input").val(generateLaserPropInputFiles());
  $("#info_div_title_1").text("LaserProperties");
  $("#info_div_title_2").text("timeVsLaserPosition");
  $("#info_div_title_1").addClass("info_div_active");
  $("#info_div_title_2").removeClass("info_div_active");
  $("#info_div_title_3").removeClass("info_div_active");

})


$("#info_div_title_1").on("click", function () {

  $("#info_div_title_1").addClass("info_div_active");
  $("#info_div_title_2").removeClass("info_div_active");
  $("#info_div_title_3").removeClass("info_div_active");


  if(liggghts_or_laser_prop === "liggghts") {

  $("#info_div_input").val(
    generateLiggghtsInput(
      parseFloat($("#plate_width").val()) / 10000,
      parseFloat(
        $("#plate_height").val() / 10000,
        parseFloat($("#plate_length").val()) / 10000,
        parseFloat($("#layer_thickness").val()) / 10000
      )
    )
  );

  }else{
    $("#info_div_input").val(generateLaserPropInputFiles());
  }

});

$("#info_div_title_2").on("click", function () {
  
  $("#info_div_title_1").removeClass("info_div_active");
  $("#info_div_title_3").removeClass("info_div_active");
  $("#info_div_title_2").addClass("info_div_active");

  if(liggghts_or_laser_prop === "liggghts") {
    $("#info_div_input").val(
      generateBedPlateDict()
    );
  }else{
    $("#info_div_input").val(generateTimeVsLaserPosition());
  }

});


$("#info_div_title_3").on("click", function () {
  
  $("#info_div_title_1").removeClass("info_div_active");
  $("#info_div_title_2").removeClass("info_div_active");
  $("#info_div_title_3").addClass("info_div_active");
  $("#info_div_input").val(generateTimeVsLaserPower());

});


document
  .getElementById("download_laser_prop_input_button")
  .addEventListener("click", async () => {
    const zip = new JSZip();

    // Simulate folder and files
    zip.folder("OF_laser_prop_files").file("OpenFOAM/constant/LaserProperties", generateLaserPropInputFiles());
    zip.folder("OF_laser_prop_files").file("OpenFOAM/constant/timeVsLaserPosition", generateTimeVsLaserPosition());
    zip.folder("OF_laser_prop_files").file("OpenFOAM/constant/timeVsLaserPower", generateTimeVsLaserPower());
  
    // Create zip file
    const blob = await zip.generateAsync({ type: "blob" });

    // Trigger download
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "OF_laser_prop_files.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });


document
  .getElementById("download_all_case_files_button")
  .addEventListener("click", async () => {
    const zip = new JSZip();

  var liggghts_input = generateLiggghtsInput(
    parseFloat($("#plate_width").val()) / 10000,
    parseFloat(
      $("#plate_height").val() / 10000,
      parseFloat($("#plate_length").val()) / 10000,
      parseFloat($("#layer_thickness").val()) / 10000
    ))

    var bedPlateDict = generateBedPlateDict();

    // Create a mesh from the box geometry (not the edges)
    // Plate geometry
    const export_geometry_box = new THREE.BoxGeometry(
      parseFloat($("#plate_width").val()),
      parseFloat($("#plate_height").val()),
      parseFloat($("#plate_length").val())
    );

    // Move so that the minimum corner is at (0,0,0)
    export_geometry_box.translate(
      parseFloat($("#plate_width").val()) / 2,
      parseFloat($("#plate_height").val()) / 2,
      parseFloat($("#plate_length").val()) / 2
    );

    // Domain geometry
    const export_geometry_domain = new THREE.BoxGeometry(
      parseFloat($("#plate_width").val()),
      (parseFloat($("#plate_height").val()) +
        parseFloat($("#layer_thickness").val())) *
        3.33,
      parseFloat($("#plate_length").val())
    );
    // Move so that the minimum corner is at (0,0,0)
    export_geometry_domain.translate(
      parseFloat($("#plate_width").val()) / 2,
      ((parseFloat($("#plate_height").val()) +
        parseFloat($("#layer_thickness").val())) *
        3.33) /
        2,
      parseFloat($("#plate_length").val()) / 2
    );

    const export_mesh_box = new THREE.Mesh(
      export_geometry_box,
      new THREE.MeshBasicMaterial()
    );
    const export_mesh_domain = new THREE.Mesh(
      export_geometry_domain,
      new THREE.MeshBasicMaterial()
    );

    const exporter = new STLExporter();
    const stl_string_box = exporter.parse(export_mesh_box);
    const stl_string_domain = exporter.parse(export_mesh_domain);

    // Simulate folder and files
    zip.folder("OF_and_LIGGGHTS_case_files").file("LIGGGHTS/liggghts.in", liggghts_input);
    zip.folder("OF_and_LIGGGHTS_case_files").file("LIGGGHTS/mesh/plate.stl", stl_string_box);
    zip.folder("OF_and_LIGGGHTS_case_files").file("LIGGGHTS/mesh/domain.stl", stl_string_domain);

    zip.folder("OF_and_LIGGGHTS_case_files").file("OpenFOAM/system/bedPlateDict", bedPlateDict);
    zip.folder("OF_and_LIGGGHTS_case_files").file("OpenFOAM/constant/LaserProperties", generateLaserPropInputFiles());
    zip.folder("OF_and_LIGGGHTS_case_files").file("OpenFOAM/constant/timeVsLaserPosition", generateTimeVsLaserPosition());
    zip.folder("OF_and_LIGGGHTS_case_files").file("OpenFOAM/constant/timeVsLaserPower", generateTimeVsLaserPower());
  
    // Create zip file
    const blob = await zip.generateAsync({ type: "blob" });

    // Trigger download
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "OF_and_LIGGGHTS_case_files.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });



  