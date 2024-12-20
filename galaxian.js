/* GLOBAL CONSTANTS AND VARIABLES */

/* Game-specific globals */
var gl = null;

// View parameters
var Eye = vec3.fromValues(0.0, 0.0, -7.0); // camera position
var Center = vec3.fromValues(0.0, 0.0, 0.0);
var Up = vec3.fromValues(0.0, 1.0, 0.0);

// shader attribute and uniform locations
var shaderProgram;
var vPosAttribLoc;
var vNormAttribLoc;
var mMatrixULoc;
var pvmMatrixULoc;
var normalMatrixULoc;
var lightPositionULoc;
var uColorULoc;

var hardMode = false;
var backgroundImageSrc = "sky.png"; // initial background for easy mode

// alien movement
var alienDirection = 1;
var alienSpeed = 0.02;
var alienLeftLimit = -3.0;
var alienRightLimit = 3.0;

// alien color
var colorChangeInterval = 3000; // in ms
var lastColorChangeTime = 0;
var currentAlienColor = [1.0, 0.0, 0.0, 1.0]; // red
var alternateAlienColor = [0.0, 0.0, 1.0, 1.0]; // blue

// alien descent
var lastDescentTime = 0;
var descentInterval = 5000; // in ms
var descentGap = 1000; // time between descending aliens
var descendingAliens = [];

var lowerRowY = 1.5;

var gameOverFlag = false;

// bullets
var spaceshipShot = null;
var shotSpeed = 0.1; // bullet speed

// alien bullets
var alienProjectiles = [];
var alienProjectileSpeed = 0.08; // speed of alien projectiles, greater than alien's descent speed

var spaceshipModel = {};
var alienModels = [];

// input state
var keysPressed = {};
var spaceshipSpeed = 0.05;

function setupBackground() {
  var imageCanvas = document.getElementById("myImageCanvas");
  var imageContext = imageCanvas.getContext("2d");

  // clear the canvas
  imageContext.clearRect(0, 0, imageCanvas.width, imageCanvas.height);

  var bgImg = new Image();
  bgImg.src = backgroundImageSrc;
  bgImg.onload = function () {
    imageContext.drawImage(bgImg, 0, 0, imageCanvas.width, imageCanvas.height);
  };
}

function setupWebGL() {
  var canvas = document.getElementById("myWebGLCanvas");
  gl = canvas.getContext("webgl", { alpha: true });

  try {
    if (gl == null) {
      throw "Unable to create WebGL context";
    } else {
      gl.clearDepth(1.0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      // clear with transparent background
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.0, 0.0, 0.0, 0.0); //  0.0 for transparency
    }
  } catch (e) {
    console.log(e);
  }
}

// set up shaders
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

  // compilw vertex shader
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

  // compile fragment shader
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

  // create shader program
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

  gl.useProgram(shaderProgram);

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

// making spaceship model as a pyramid
function createSpaceshipModel() {
  var positions = [
    // bottom
    -0.1, -0.1, 0.1, 0.1, -0.1, 0.1, 0.1, -0.1, -0.1, -0.1, -0.1, -0.1,

    -0.1, -0.1, 0.1, 0.1, -0.1, 0.1, 0.0, 0.1, 0.0,

    0.1, -0.1, 0.1, 0.1, -0.1, -0.1, 0.0, 0.1, 0.0,

    0.1, -0.1, -0.1, -0.1, -0.1, -0.1, 0.0, 0.1, 0.0,

    -0.1, -0.1, -0.1, -0.1, -0.1, 0.1, 0.0, 0.1, 0.0,
  ];

  var normals = [
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,

    0.0, 0.7071, 0.7071, 0.0, 0.7071, 0.7071, 0.0, 0.7071, 0.7071,

    0.7071, 0.7071, 0.0, 0.7071, 0.7071, 0.0, 0.7071, 0.7071, 0.0,

    0.0, 0.7071, -0.7071, 0.0, 0.7071, -0.7071, 0.0, 0.7071, -0.7071,

    -0.7071, 0.7071, 0.0, -0.7071, 0.7071, 0.0, -0.7071, 0.7071, 0.0,
  ];

  var indices = [
    0, 1, 2, 0, 2, 3,

    4, 5, 6,

    7, 8, 9,

    10, 11, 12,

    13, 14, 15,
  ];

  // create and bind position buffer
  spaceshipModel.vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spaceshipModel.vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  spaceshipModel.normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spaceshipModel.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  spaceshipModel.indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spaceshipModel.indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  spaceshipModel.indexCount = indices.length;
  spaceshipModel.color = [0.0, 1.0, 0.0, 1.0]; // green
  spaceshipModel.position = vec3.fromValues(0.0, -2.4, -0.8);
}

function createAlienModels() {
  var positions = [
    // front face
    -0.1, -0.1, 0.1, 0.1, -0.1, 0.1, 0.1, 0.1, 0.1, -0.1, 0.1, 0.1,
    // back face
    -0.1, -0.1, -0.1, 0.1, -0.1, -0.1, 0.1, 0.1, -0.1, -0.1, 0.1, -0.1,
    // top face
    -0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, -0.1, -0.1, 0.1, -0.1,
    // bottom face
    -0.1, -0.1, 0.1, 0.1, -0.1, 0.1, 0.1, -0.1, -0.1, -0.1, -0.1, -0.1,
    // right face
    0.1, -0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, -0.1, 0.1, -0.1, -0.1,
    // left face
    -0.1, -0.1, 0.1, -0.1, 0.1, 0.1, -0.1, 0.1, -0.1, -0.1, -0.1, -0.1,
  ];

  var normals = [
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0,
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,

    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0, 0.0,
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    0.0, 0.0, -1.0, 0.0, 0.0,
  ];

  var indices = [
    // front face
    0, 1, 2, 0, 2, 3,
    // back face
    4, 5, 6, 4, 6, 7,
    // top face
    8, 9, 10, 8, 10, 11,
    // bottom face
    12, 13, 14, 12, 14, 15,
    // right face
    16, 17, 18, 16, 18, 19,
    // ;eft face
    20, 21, 22, 20, 22, 23,
  ];

  // make aliens in a grid
  var rows = 2;
  var cols = 6;
  var spacingX = 1.0;
  var spacingY = 1.0;
  var startX = -((cols - 1) * spacingX) / 2;
  var startY = 2.5;

  for (var i = 0; i < rows; i++) {
    for (var j = 0; j < cols; j++) {
      var alien = {};

      alien.vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, alien.vertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW
      );

      alien.normalBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, alien.normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

      alien.indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, alien.indexBuffer);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW
      );

      alien.indexCount = indices.length;
      alien.color = currentAlienColor;

      var xPos = startX + j * spacingX;
      var yPos = startY - i * spacingY;
      alien.position = vec3.fromValues(xPos, yPos, 0.0);
      alien.originalPosition = vec3.clone(alien.position);

      alien.isDescending = false;
      alien.descendStartTime = 0;
      alien.sinAmplitude = 0;

      alienModels.push(alien);
    }
  }
}

function createProjectileModel(color) {
  var positions = [
    // ftonr face
    -0.05, -0.05, 0.05, 0.05, -0.05, 0.05, 0.05, 0.05, 0.05, -0.05, 0.05, 0.05,
    // back face
    -0.05, -0.05, -0.05, 0.05, -0.05, -0.05, 0.05, 0.05, -0.05, -0.05, 0.05,
    -0.05,
    // ;eft face
    -0.05, -0.05, -0.05, -0.05, -0.05, 0.05, -0.05, 0.05, 0.05, -0.05, 0.05,
    -0.05,
    // right face
    0.05, -0.05, -0.05, 0.05, -0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, -0.05,
    // top face
    -0.05, 0.05, -0.05, -0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, -0.05,
    // bottom face
    -0.05, -0.05, -0.05, -0.05, -0.05, 0.05, 0.05, -0.05, 0.05, 0.05, -0.05,
    -0.05,
  ];

  var normals = [
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,

    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,

    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,

    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,

    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,

    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
  ];

  var indices = [
    // front face
    0, 1, 2, 0, 2, 3,
    // back face
    4, 5, 6, 4, 6, 7,
    // left face
    8, 9, 10, 8, 10, 11,
    // right face
    12, 13, 14, 12, 14, 15,
    // top face
    16, 17, 18, 16, 18, 19,
    // bottom face
    20, 21, 22, 20, 22, 23,
  ];

  var projectile = {};

  projectile.vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, projectile.vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  projectile.normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, projectile.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  projectile.indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, projectile.indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  projectile.indexCount = indices.length;
  projectile.color = color;
  projectile.position = vec3.create();

  return projectile;
}

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

  // render spaceship
  renderModel(spaceshipModel, pvMatrix);

  // render aliens
  for (var i = 0; i < alienModels.length; i++) {
    renderModel(alienModels[i], pvMatrix);
  }

  // render spaceship shot if it exists
  if (spaceshipShot !== null) {
    renderModel(spaceshipShot, pvMatrix);
  }

  // render alien projectiles
  for (var i = 0; i < alienProjectiles.length; i++) {
    renderModel(alienProjectiles[i], pvMatrix);
  }

  // check for errors
  var error = gl.getError();
  if (error !== gl.NO_ERROR) {
    console.error("WebGL Error:", error);
  }
}

function renderModel(model, pvMatrix) {
  var mMatrix = mat4.create();
  mat4.translate(mMatrix, mMatrix, model.position);

  // adjust scaling
  if (model === spaceshipModel) {
    mat4.scale(mMatrix, mMatrix, vec3.fromValues(2.5, 2.5, 2.5));
  } else if (alienModels.includes(model)) {
    mat4.scale(mMatrix, mMatrix, vec3.fromValues(2.0, 2.0, 2.0));
  } else if (model === spaceshipShot) {
    mat4.scale(mMatrix, mMatrix, vec3.fromValues(1.5, 1.5, 1.5)); // Scale the shot
  } else if (alienProjectiles.includes(model)) {
    mat4.scale(mMatrix, mMatrix, vec3.fromValues(1.5, 1.5, 1.5)); // Scale alien projectile
  }

  var pvmMatrix = mat4.create();
  mat4.multiply(pvmMatrix, pvMatrix, mMatrix);

  // calculate normal matrix
  var normalMatrix = mat3.create();
  mat3.normalFromMat4(normalMatrix, mMatrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
  gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
  gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0);

  // set uniforms
  gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix);
  gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix);
  gl.uniformMatrix3fv(normalMatrixULoc, false, normalMatrix);
  gl.uniform3fv(lightPositionULoc, [2.0, 5.0, -3.0]);
  gl.uniform4fv(uColorULoc, model.color);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
  gl.drawElements(gl.TRIANGLES, model.indexCount, gl.UNSIGNED_SHORT, 0);
}

function setupEventHandlers() {
  window.addEventListener(
    "keydown",
    function (event) {
      keysPressed[event.key] = true;

      // shoot with space
      if (event.key === " " && spaceshipShot === null) {
        spaceshipShot = createProjectileModel([1.0, 1.0, 0.0, 1.0]);
        vec3.copy(spaceshipShot.position, spaceshipModel.position);
        spaceshipShot.position[1] += 0.3;
      }

      // ! toggle
      if (event.key === "!") {
        switchModes();
      }
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

function startAlienDescent(currentTime) {
  // find aliens that are not descending
  var availableAliens = alienModels.filter((alien) => !alien.isDescending);

  if (availableAliens.length > 0) {
    // randomly select an alien
    var index = Math.floor(Math.random() * availableAliens.length);
    var alien = availableAliens[index];

    // set descending properties
    alien.isDescending = true;
    alien.descendStartTime = currentTime;
    alien.sinAmplitude = Math.random() * 0.5 + 0.5; // amplitude between 0.5 and 1.0
    alien.hasStartedShooting = false;

    // add to descending aliens list
    descendingAliens.push(alien);
  }
}

function updateDescendingAliens(currentTime) {
  var descentSpeed = 0.04;
  var frequency = 2.0;

  for (var i = descendingAliens.length - 1; i >= 0; i--) {
    var alien = descendingAliens[i];

    var prevPosition = vec3.clone(alien.position);

    alien.position[1] -= descentSpeed;

    var elapsedTime = (currentTime - alien.descendStartTime) / 1000; // convert to seconds
    alien.position[0] +=
      alien.sinAmplitude * Math.sin(frequency * elapsedTime) * 0.02;

    // check if alien has passed below lower row and hasn't started shooting
    if (!alien.hasStartedShooting && alien.position[1] <= lowerRowY) {
      alien.hasStartedShooting = true;

      var dx = alien.position[0] - prevPosition[0];
      var dy = alien.position[1] - prevPosition[1];
      var slope = dy !== 0 ? dx / dy : 0;
      var projectileSlope = -slope;

      shootAlienProjectiles(alien, projectileSlope);
    }

    // check collision with spaceship
    if (checkCollision(alien, spaceshipModel)) {
      gameOver();
      return; // exit the animation loop
    }

    // remove alien if it goes off the screen
    if (alien.position[1] < -3.0) {
      resetAlienPosition(alien);
      descendingAliens.splice(i, 1);
    }
  }
}

function resetAlienPosition(alien) {
  alien.isDescending = false;
  alien.hasStartedShooting = false;
  alien.position = vec3.clone(alien.originalPosition);
}

function resetGameState() {
  // clear arrays
  alienModels = [];
  descendingAliens = [];
  alienProjectiles = [];
  spaceshipShot = null;

  // recreate models
  createSpaceshipModel();
  createAlienModels();
}

function switchModes() {
  hardMode = !hardMode;
  if (hardMode) {
    backgroundImageSrc = "space.png";
    alienSpeed = 0.05; // faster in hard mode
  } else {
    backgroundImageSrc = "sky.png";
    alienSpeed = 0.02; // normal speed
  }

  setupBackground();
  resetGameState();
}

function shootAlienProjectiles(alien, projectileSlope) {
  var numProjectiles = 3;
  var intervalBetweenShots = hardMode ? 200 : 500; // faster when in hard mode

  for (let i = 0; i < numProjectiles; i++) {
    setTimeout(function () {
      var projectile = createProjectileModel([1.0, 0.0, 0.0, 1.0]); // red
      vec3.copy(projectile.position, alien.position);
      projectile.slope = projectileSlope;
      projectile.isAlienProjectile = true;
      alienProjectiles.push(projectile);
    }, i * intervalBetweenShots);
  }
}

function updateAlienProjectiles() {
  for (var i = alienProjectiles.length - 1; i >= 0; i--) {
    var projectile = alienProjectiles[i];

    // update projectile position
    projectile.position[1] -= alienProjectileSpeed;
    projectile.position[0] += projectile.slope * alienProjectileSpeed;

    if (checkCollision(projectile, spaceshipModel)) {
      gameOver();
      return; // exit the animation loop
    }

    // remove projectile if it goes off the screen
    if (
      projectile.position[1] < -3.5 ||
      projectile.position[0] < -4.0 ||
      projectile.position[0] > 4.0
    ) {
      alienProjectiles.splice(i, 1);
    }
  }
}

function checkCollision(a, b) {
  var aSize = null;
  var bSize = null;

  // collision margin
  var collisionMargin = 0.07;
  // model a
  if (a === spaceshipModel) {
    var spaceshipWidth = 0.2 * 2.5 - collisionMargin;
    var spaceshipHeight = 0.2 * 2.5 - collisionMargin;
    aSize = { width: spaceshipWidth, height: spaceshipHeight };
  } else if (alienModels.includes(a)) {
    var alienWidth = 0.2 * 2.0 - collisionMargin;
    var alienHeight = 0.2 * 2.0 - collisionMargin;
    aSize = { width: alienWidth, height: alienHeight };
  } else if (a === spaceshipShot || alienProjectiles.includes(a)) {
    var shotWidth = 0.1 * 1.5 - collisionMargin;
    var shotHeight = 0.1 * 1.5 - collisionMargin;
    aSize = { width: shotWidth, height: shotHeight };
  } else {
    return false;
  }

  if (b === spaceshipModel) {
    var spaceshipWidth = 0.2 * 2.5 - collisionMargin;
    var spaceshipHeight = 0.2 * 2.5 - collisionMargin;
    bSize = { width: spaceshipWidth, height: spaceshipHeight };
  } else if (alienModels.includes(b)) {
    var alienWidth = 0.2 * 2.0 - collisionMargin;
    var alienHeight = 0.2 * 2.0 - collisionMargin;
    bSize = { width: alienWidth, height: alienHeight };
  } else if (b === spaceshipShot || alienProjectiles.includes(b)) {
    var shotWidth = 0.1 * 1.5 - collisionMargin;
    var shotHeight = 0.1 * 1.5 - collisionMargin;
    bSize = { width: shotWidth, height: shotHeight };
  } else {
    return false;
  }

  // bounding boxes
  var aLeft = a.position[0] - aSize.width / 2;
  var aRight = a.position[0] + aSize.width / 2;
  var aBottom = a.position[1] - aSize.height / 2;
  var aTop = a.position[1] + aSize.height / 2;

  var bLeft = b.position[0] - bSize.width / 2;
  var bRight = b.position[0] + bSize.width / 2;
  var bBottom = b.position[1] - bSize.height / 2;
  var bTop = b.position[1] + bSize.height / 2;

  // check for overlap
  var xOverlap = aLeft < bRight && aRight > bLeft;
  var yOverlap = aBottom < bTop && aTop > bBottom;

  return xOverlap && yOverlap;
}

// game over function
function gameOver() {
  gameOverFlag = true;
  alert("Game Over!");
}

function main() {
  setupWebGL();
  setupShaders();
  createSpaceshipModel();
  createAlienModels();
  setupEventHandlers();

  setupBackground();

  requestAnimationFrame(animate);
}

function animate(currentTime) {
  // handle initial currentTime
  if (!lastColorChangeTime) {
    lastColorChangeTime = currentTime;
    lastDescentTime = currentTime;
  }

  // handle input
  if (keysPressed["ArrowRight"]) {
    spaceshipModel.position[0] -= spaceshipSpeed;
  }
  if (keysPressed["ArrowLeft"]) {
    spaceshipModel.position[0] += spaceshipSpeed;
  }

  var leftLimit = -3.5;
  var rightLimit = 3.5;
  if (spaceshipModel.position[0] < leftLimit) {
    spaceshipModel.position[0] = leftLimit;
  }
  if (spaceshipModel.position[0] > rightLimit) {
    spaceshipModel.position[0] = rightLimit;
  }

  // move aliens
  for (var i = 0; i < alienModels.length; i++) {
    var alien = alienModels[i];
    if (!alien.isDescending) {
      alien.position[0] += alienDirection * alienSpeed;
    }
  }

  // check if aliens reached the boundaries
  var aliensAtLeftLimit = alienModels.some(
    (alien) => !alien.isDescending && alien.position[0] <= alienLeftLimit
  );
  var aliensAtRightLimit = alienModels.some(
    (alien) => !alien.isDescending && alien.position[0] >= alienRightLimit
  );

  if (aliensAtLeftLimit || aliensAtRightLimit) {
    alienDirection *= -1;
  }

  if (currentTime - lastColorChangeTime >= colorChangeInterval) {
    var tempColor = currentAlienColor;
    currentAlienColor = alternateAlienColor;
    alternateAlienColor = tempColor;

    for (var i = 0; i < alienModels.length; i++) {
      alienModels[i].color = currentAlienColor;
    }

    lastColorChangeTime = currentTime;
  }

  // schedule alien descents
  if (currentTime - lastDescentTime >= descentInterval) {
    startAlienDescent(currentTime);
    setTimeout(function () {
      startAlienDescent(currentTime + descentGap);
    }, descentGap);
    lastDescentTime = currentTime;
  }

  // update descending aliens
  updateDescendingAliens(currentTime);

  // update spaceship shot
  if (spaceshipShot !== null) {
    spaceshipShot.position[1] += shotSpeed;

    // cehck for collisions with aliens
    for (var i = 0; i < alienModels.length; i++) {
      var alien = alienModels[i];
      if (checkCollision(spaceshipShot, alien)) {
        // remove alien from the array
        alienModels.splice(i, 1);
        i--;

        spaceshipShot = null;

        break;
      }
    }

    if (spaceshipShot !== null && spaceshipShot.position[1] > 3.5) {
      spaceshipShot = null;
    }
  }

  updateAlienProjectiles();

  if (gameOverFlag) return;

  if (alienModels.length === 0 && !gameOverFlag) {
    alert("YOU WIN!!!");
    gameOverFlag = true;
    return;
  }

  renderModels();
  requestAnimationFrame(animate);
}
