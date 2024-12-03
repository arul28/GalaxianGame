/* GLOBAL CONSTANTS AND VARIABLES */

/* Game-specific globals */
var gl = null; // The WebGL context

// View parameters
var Eye = vec3.fromValues(0.0, 0.0, -7.0); // Camera position
var Center = vec3.fromValues(0.0, 0.0, 0.0); // Where the camera is looking
var Up = vec3.fromValues(0.0, 1.0, 0.0); // Up vector

// Shader attribute and uniform locations
var shaderProgram;
var vPosAttribLoc;
var vNormAttribLoc;
var mMatrixULoc;
var pvmMatrixULoc;
var normalMatrixULoc;
var lightPositionULoc;
var uColorULoc;

// Model data
var spaceshipModel = {};
var alienModels = [];

// Input state variables
var keysPressed = {};
var spaceshipSpeed = 0.05; // Adjust the speed as needed

// Set up WebGL environment
function setupWebGL() {
  // Get the canvas and context
  var canvas = document.getElementById("myWebGLCanvas");
  gl = canvas.getContext("webgl");

  try {
    if (gl == null) {
      throw "Unable to create WebGL context";
    } else {
      gl.clearDepth(1.0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
    }
  } catch (e) {
    console.log(e);
  }
}

// Set up shaders
function setupShaders() {
  var vShaderCode = `
    attribute vec3 aVertexPosition;
    attribute vec3 aVertexNormal;

    uniform mat4 umMatrix;
    uniform mat4 upvmMatrix;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec3 vPosition;

    void main(void) {
        vPosition = vec3(umMatrix * vec4(aVertexPosition, 1.0));
        vNormal = normalize(uNormalMatrix * aVertexNormal);
        gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);
    }
  `;

  var fShaderCode = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vPosition;

    uniform vec3 uLightPosition;
    uniform vec4 uColor;

    void main(void) {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(uLightPosition - vPosition);

        // Ambient light
        float ambientStrength = 0.5;
        vec3 ambient = ambientStrength * uColor.rgb;

        // Diffuse light
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * uColor.rgb;

        vec3 result = ambient + diffuse;
        gl_FragColor = vec4(result, uColor.a);
    }
  `;

  // Compile vertex shader
  var vShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vShader, vShaderCode);
  gl.compileShader(vShader);
  if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
    console.error(
      "An error occurred compiling the vertex shader:",
      gl.getShaderInfoLog(vShader)
    );
    gl.deleteShader(vShader);
    return;
  }

  // Compile fragment shader
  var fShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fShader, fShaderCode);
  gl.compileShader(fShader);
  if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
    console.error(
      "An error occurred compiling the fragment shader:",
      gl.getShaderInfoLog(fShader)
    );
    gl.deleteShader(fShader);
    return;
  }

  // Create shader program
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vShader);
  gl.attachShader(shaderProgram, fShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error(
      "Unable to initialize the shader program:",
      gl.getProgramInfoLog(shaderProgram)
    );
    return;
  }

  // Use the shader program
  gl.useProgram(shaderProgram);

  // Get attribute and uniform locations
  vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(vPosAttribLoc);

  vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(vNormAttribLoc);

  mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix");
  pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix");
  normalMatrixULoc = gl.getUniformLocation(shaderProgram, "uNormalMatrix");
  lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
  uColorULoc = gl.getUniformLocation(shaderProgram, "uColor");
}

// Create spaceship model as a pyramid with normals
function createSpaceshipModel() {
  // Define positions and normals for a pyramid with flat shading
  var positions = [
    // Base face (bottom)
    -0.1,
    -0.1,
    0.1, // 0
    0.1,
    -0.1,
    0.1, // 1
    0.1,
    -0.1,
    -0.1, // 2
    -0.1,
    -0.1,
    -0.1, // 3

    // Side face 1
    -0.1,
    -0.1,
    0.1, // 4
    0.1,
    -0.1,
    0.1, // 5
    0.0,
    0.1,
    0.0, // 6

    // Side face 2
    0.1,
    -0.1,
    0.1, // 7
    0.1,
    -0.1,
    -0.1, // 8
    0.0,
    0.1,
    0.0, // 9

    // Side face 3
    0.1,
    -0.1,
    -0.1, // 10
    -0.1,
    -0.1,
    -0.1, // 11
    0.0,
    0.1,
    0.0, // 12

    // Side face 4
    -0.1,
    -0.1,
    -0.1, // 13
    -0.1,
    -0.1,
    0.1, // 14
    0.0,
    0.1,
    0.0, // 15
  ];

  var normals = [
    // Base face normal (downward)
    0.0,
    -1.0,
    0.0, // 0
    0.0,
    -1.0,
    0.0, // 1
    0.0,
    -1.0,
    0.0, // 2
    0.0,
    -1.0,
    0.0, // 3

    // Side face 1 normal
    0.0,
    0.7071,
    0.7071, // 4
    0.0,
    0.7071,
    0.7071, // 5
    0.0,
    0.7071,
    0.7071, // 6

    // Side face 2 normal
    0.7071,
    0.7071,
    0.0, // 7
    0.7071,
    0.7071,
    0.0, // 8
    0.7071,
    0.7071,
    0.0, // 9

    // Side face 3 normal
    0.0,
    0.7071,
    -0.7071, // 10
    0.0,
    0.7071,
    -0.7071, // 11
    0.0,
    0.7071,
    -0.7071, // 12

    // Side face 4 normal
    -0.7071,
    0.7071,
    0.0, // 13
    -0.7071,
    0.7071,
    0.0, // 14
    -0.7071,
    0.7071,
    0.0, // 15
  ];

  var indices = [
    // Base face (two triangles)
    0, 1, 2, 0, 2, 3,

    // Side face 1
    4, 5, 6,

    // Side face 2
    7, 8, 9,

    // Side face 3
    10, 11, 12,

    // Side face 4
    13, 14, 15,
  ];

  // Create and bind position buffer
  spaceshipModel.vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spaceshipModel.vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Create and bind normal buffer
  spaceshipModel.normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spaceshipModel.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  // Create and bind index buffer
  spaceshipModel.indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spaceshipModel.indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  spaceshipModel.indexCount = indices.length;
  spaceshipModel.color = [0.0, 1.0, 0.0, 1.0]; // Green color
  spaceshipModel.position = vec3.fromValues(0.0, -2.4, -0.8); // Spaceship position
}

// Create alien models as cubes with normals
function createAlienModels() {
  // Define positions and normals for a cube with flat shading
  var positions = [
    // Front face
    -0.1,
    -0.1,
    0.1, // 0
    0.1,
    -0.1,
    0.1, // 1
    0.1,
    0.1,
    0.1, // 2
    -0.1,
    0.1,
    0.1, // 3
    // Back face
    -0.1,
    -0.1,
    -0.1, // 4
    0.1,
    -0.1,
    -0.1, // 5
    0.1,
    0.1,
    -0.1, // 6
    -0.1,
    0.1,
    -0.1, // 7
    // Top face
    -0.1,
    0.1,
    0.1, // 8
    0.1,
    0.1,
    0.1, // 9
    0.1,
    0.1,
    -0.1, // 10
    -0.1,
    0.1,
    -0.1, // 11
    // Bottom face
    -0.1,
    -0.1,
    0.1, // 12
    0.1,
    -0.1,
    0.1, // 13
    0.1,
    -0.1,
    -0.1, // 14
    -0.1,
    -0.1,
    -0.1, // 15
    // Right face
    0.1,
    -0.1,
    0.1, // 16
    0.1,
    0.1,
    0.1, // 17
    0.1,
    0.1,
    -0.1, // 18
    0.1,
    -0.1,
    -0.1, // 19
    // Left face
    -0.1,
    -0.1,
    0.1, // 20
    -0.1,
    0.1,
    0.1, // 21
    -0.1,
    0.1,
    -0.1, // 22
    -0.1,
    -0.1,
    -0.1, // 23
  ];

  var normals = [
    // Front face normals
    0.0,
    0.0,
    1.0, // 0
    0.0,
    0.0,
    1.0, // 1
    0.0,
    0.0,
    1.0, // 2
    0.0,
    0.0,
    1.0, // 3
    // Back face normals
    0.0,
    0.0,
    -1.0, // 4
    0.0,
    0.0,
    -1.0, // 5
    0.0,
    0.0,
    -1.0, // 6
    0.0,
    0.0,
    -1.0, // 7
    // Top face normals
    0.0,
    1.0,
    0.0, // 8
    0.0,
    1.0,
    0.0, // 9
    0.0,
    1.0,
    0.0, // 10
    0.0,
    1.0,
    0.0, // 11
    // Bottom face normals
    0.0,
    -1.0,
    0.0, // 12
    0.0,
    -1.0,
    0.0, // 13
    0.0,
    -1.0,
    0.0, // 14
    0.0,
    -1.0,
    0.0, // 15
    // Right face normals
    1.0,
    0.0,
    0.0, // 16
    1.0,
    0.0,
    0.0, // 17
    1.0,
    0.0,
    0.0, // 18
    1.0,
    0.0,
    0.0, // 19
    // Left face normals
    -1.0,
    0.0,
    0.0, // 20
    -1.0,
    0.0,
    0.0, // 21
    -1.0,
    0.0,
    0.0, // 22
    -1.0,
    0.0,
    0.0, // 23
  ];

  var indices = [
    // Front face
    0, 1, 2, 0, 2, 3,
    // Back face
    4, 5, 6, 4, 6, 7,
    // Top face
    8, 9, 10, 8, 10, 11,
    // Bottom face
    12, 13, 14, 12, 14, 15,
    // Right face
    16, 17, 18, 16, 18, 19,
    // Left face
    20, 21, 22, 20, 22, 23,
  ];

  // Create aliens in a grid
  var rows = 2;
  var cols = 6;
  var spacingX = 1.0; // Increased spacing to accommodate larger cubes
  var spacingY = 1.0;
  var startX = -((cols - 1) * spacingX) / 2;
  var startY = 2.5; // Aliens positioned higher up

  for (var i = 0; i < rows; i++) {
    for (var j = 0; j < cols; j++) {
      var alien = {};

      // Create and bind position buffer
      alien.vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, alien.vertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW
      );

      // Create and bind normal buffer
      alien.normalBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, alien.normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

      // Create and bind index buffer
      alien.indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, alien.indexBuffer);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW
      );

      alien.indexCount = indices.length;
      alien.color = [1.0, 0.0, 0.0, 1.0]; // Red color

      var xPos = startX + j * spacingX;
      var yPos = startY - i * spacingY;
      alien.position = vec3.fromValues(xPos, yPos, 0.0);

      alienModels.push(alien);
    }
  }
}

// Render models
function renderModels() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var pMatrix = mat4.create();
  var vMatrix = mat4.create();
  var pvMatrix = mat4.create();

  var fieldOfView = (60 * Math.PI) / 180;
  var aspectRatio = gl.canvas.clientWidth / gl.canvas.clientHeight;
  var near = 0.1;
  var far = 100.0;
  mat4.perspective(pMatrix, fieldOfView, aspectRatio, near, far);

  mat4.lookAt(vMatrix, Eye, Center, Up);
  mat4.multiply(pvMatrix, pMatrix, vMatrix);

  // Render spaceship
  renderModel(spaceshipModel, pvMatrix);

  // Render aliens
  for (var i = 0; i < alienModels.length; i++) {
    renderModel(alienModels[i], pvMatrix);
  }

  // Check for errors
  var error = gl.getError();
  if (error !== gl.NO_ERROR) {
    console.error("WebGL Error:", error);
  }
}

// Render a single model
function renderModel(model, pvMatrix) {
  var mMatrix = mat4.create();
  mat4.translate(mMatrix, mMatrix, model.position);

  // Adjust scaling based on the model
  if (model === spaceshipModel) {
    mat4.scale(mMatrix, mMatrix, vec3.fromValues(2.5, 2.5, 2.5)); // Decreased spaceship scale
  } else {
    mat4.scale(mMatrix, mMatrix, vec3.fromValues(2.0, 2.0, 2.0)); // Increased alien size
  }

  var pvmMatrix = mat4.create();
  mat4.multiply(pvmMatrix, pvMatrix, mMatrix);

  // Calculate normal matrix
  var normalMatrix = mat3.create();
  mat3.normalFromMat4(normalMatrix, mMatrix);

  // Bind position buffer and set attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
  gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0);

  // Bind normal buffer and set attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
  gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0);

  // Set uniforms
  gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix);
  gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix);
  gl.uniformMatrix3fv(normalMatrixULoc, false, normalMatrix);
  gl.uniform3fv(lightPositionULoc, [2.0, 5.0, -3.0]); // Light position
  gl.uniform4fv(uColorULoc, model.color);

  // Bind the index buffer and draw elements
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
  gl.drawElements(gl.TRIANGLES, model.indexCount, gl.UNSIGNED_SHORT, 0);
}

// Set up event handlers for keyboard input
function setupEventHandlers() {
  window.addEventListener(
    "keydown",
    function (event) {
      keysPressed[event.key] = true;
    },
    false
  );

  window.addEventListener(
    "keyup",
    function (event) {
      keysPressed[event.key] = false;
    },
    false
  );
}

// Main function
function main() {
  setupWebGL();
  setupShaders();
  createSpaceshipModel();
  createAlienModels();
  setupEventHandlers(); // Added to set up keyboard input

  // Start the rendering loop
  requestAnimationFrame(animate);
}

// Animation loop
function animate() {
  // Handle input
  if (keysPressed["ArrowRight"]) {
    spaceshipModel.position[0] -= spaceshipSpeed;
  }
  if (keysPressed["ArrowLeft"]) {
    spaceshipModel.position[0] += spaceshipSpeed;
  }

  // Limit the spaceship's movement to the screen bounds
  var leftLimit = -3.5; // Adjust these values based on your scene
  var rightLimit = 3.5;
  if (spaceshipModel.position[0] < leftLimit) {
    spaceshipModel.position[0] = leftLimit;
  }
  if (spaceshipModel.position[0] > rightLimit) {
    spaceshipModel.position[0] = rightLimit;
  }

  renderModels();
  requestAnimationFrame(animate);
}
