var gl;
//all textures loaded cheack and only then call render/update stuff (option)
//fullscreen option
//loader at start option
//full screen filters, write entire screen to texture and apply
//texture load filters
var Plena;
(function (Plena) {
    var renderLp, updateLp;
    var canvas;
    var lastTick;
    var shadColFrag = "\
        precision highp float; \
        \
        uniform vec4 color; \
        \
        void main(void){ \
            gl_FragColor = color; \
        } ";
    var shadColVertex = "\
        precision highp float; \
        \
        uniform mat4 modelMatrix; \
        uniform mat4 projectionMatrix; \
        uniform mat4 viewMatrix; \
        \
        attribute vec2 vertexPos; \
        \
        void main(void){ \
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(vertexPos, 1, 1); \
        }";
    var shadTexFrag = "\
        precision highp float; \
        \
        varying vec2 UV; \
        \
        uniform sampler2D sampler; \
        \
        void main(void){ \
            gl_FragColor = texture2D(sampler, UV); \
        }";
    var shadTexVertex = "\
        precision highp float; \
        \
        uniform mat4 modelMatrix; \
        uniform mat4 projectionMatrix; \
        uniform mat4 viewMatrix; \
        uniform mat4 UVMatrix; \
        \
        varying vec2 UV; \
        \
        attribute vec2 vertexPos; \
        attribute vec2 vertexUV; \
        \
        void main(void){ \
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(vertexPos, 1, 1); \
            UV = (UVMatrix * vec4(vertexUV, 1, 1)).xy; \
        } ";
    var colorShader;
    var textureShader;
    var spriteManager;
    var textureManager;
    var audioManager;
    var camera;
    var projection;
    var projectionSave;
    function init(setupFunc, renderLoop, updateLoop, p1, p2, p3, p4, p5) {
        var width, height, x, y;
        var color;
        if (typeof p3 == 'number') {
            width = p3;
            height = p4;
            x = p1;
            y = p2;
            if (p5)
                color = p5;
            else
                color = [1, 1, 1, 1];
        }
        else if (typeof p2 == 'number') {
            width = p1;
            height = p2;
            x = window.innerWidth / 2 - width / 2;
            y = window.innerHeight / 2 - height / 2;
            if (p3)
                color = p3;
            else
                color = [1, 1, 1, 1];
        }
        else {
            width = window.innerWidth;
            height = window.innerHeight;
            x = 0;
            y = 0;
            if (p1)
                color = p1;
            else
                color = [1, 1, 1, 1];
        }
        textureManager = new TextureManager();
        audioManager = new AudioManager();
        canvas = document.createElement('canvas');
        canvas.setAttribute("width", "" + width);
        canvas.setAttribute("height", "" + height);
        canvas.setAttribute("style", "position:fixed; top:" + y + "px; left:" + x + "px");
        document.body.appendChild(canvas);
        Plena.width = width;
        Plena.height = height;
        gl = canvas.getContext("experimental-webgl");
        GLF.viewPort(0, 0, width, height);
        GLF.alphaBlend();
        GLF.clearColor(color);
        GLF.clearBufferColor();
        Keyboard.listenForKeys();
        Mouse.listenForPosition();
        Mouse.listenForClick();
        colorShader = createShader(ShaderType.COLOR);
        textureShader = createShader(ShaderType.TEXTURE);
        changeProjection(0, width, height, 0);
        spriteManager = createManager();
        spriteManager.addShader(colorShader);
        spriteManager.addShader(textureShader);
        renderLp = renderLoop;
        updateLp = updateLoop;
        lastTick = Date.now();
        setupFunc();
        looper();
    }
    Plena.init = init;
    function loadSpriteFile(src, safe, repeat, smooth, id) {
        if (!id)
            id = src.split("/").pop().split('.')[0];
        return textureManager.loadSprite(src, id, safe ? true : false, repeat, smooth);
    }
    Plena.loadSpriteFile = loadSpriteFile;
    function loadImg(src, repeat, smooth, id) {
        if (!id)
            id = src.split("/").pop().split('.')[0];
        return textureManager.loadImg(src, id, repeat, smooth);
    }
    Plena.loadImg = loadImg;
    function mkWritableImg(width, height, smooth, repeat) {
        return new WritableTexture(width, height, smooth, repeat);
    }
    Plena.mkWritableImg = mkWritableImg;
    function saveProjection() {
        projectionSave = projection;
    }
    Plena.saveProjection = saveProjection;
    function restoreProjection() {
        changeProjection(projectionSave[0], projectionSave[1], projectionSave[2], projectionSave[3]);
    }
    Plena.restoreProjection = restoreProjection;
    function getSprite(key) {
        return textureManager.getSprite(key);
    }
    Plena.getSprite = getSprite;
    function getImg(key) {
        return textureManager.getTexture(key);
    }
    Plena.getImg = getImg;
    function bindCameraTo(entity) {
        if (camera == null)
            camera = new Camera(entity);
        else
            camera.bindTo(entity);
    }
    Plena.bindCameraTo = bindCameraTo;
    function changeCamera(camera) {
        camera = camera;
    }
    Plena.changeCamera = changeCamera;
    function getCamera() {
        return camera;
    }
    Plena.getCamera = getCamera;
    function changeProjection(left, right, bottom, top) {
        var ortho;
        if (typeof bottom == 'number') {
            ortho = Matrix4.ortho(left, right, bottom, top);
            projection = [left, right, bottom, top];
        }
        else {
            ortho = Matrix4.ortho(0, left, right, 0);
            projection = [0, left, right, 0];
        }
        colorShader.bind();
        colorShader.getMatHandler().setProjectionMatrix(ortho);
        textureShader.bind();
        textureShader.getMatHandler().setProjectionMatrix(ortho);
    }
    Plena.changeProjection = changeProjection;
    function looper() {
        GLF.clearBufferColor();
        var tick = Date.now();
        var delta = tick - lastTick;
        lastTick = tick;
        if (camera != null)
            camera.update();
        renderLp(delta);
        updateLp(delta);
        spriteManager.render();
        requestAnimationFrame(looper);
    }
    function forceRender() {
        spriteManager.render();
    }
    Plena.forceRender = forceRender;
    function getBasicShader(typ) {
        switch (typ) {
            case ShaderType.COLOR: return colorShader;
            case ShaderType.TEXTURE: return textureShader;
        }
    }
    Plena.getBasicShader = getBasicShader;
    (function (ShaderType) {
        ShaderType[ShaderType["COLOR"] = 0] = "COLOR";
        ShaderType[ShaderType["TEXTURE"] = 1] = "TEXTURE";
    })(Plena.ShaderType || (Plena.ShaderType = {}));
    var ShaderType = Plena.ShaderType;
    function createShader(typ) {
        var shad;
        if (typ == ShaderType.COLOR) {
            shad = new Shader("plenaColorShader", { "projectionMatrix": Shader.PROJECTION_MATRIX, "viewMatrix": Shader.VIEW_MATRIX, "modelMatrix": Shader.MODEL_MATRIX, "color": Shader.COLOR }, shadColVertex, shadColFrag);
        }
        else {
            shad = new Shader("plenaTextureShader", { "projectionMatrix": Shader.PROJECTION_MATRIX, "viewMatrix": Shader.VIEW_MATRIX, "modelMatrix": Shader.MODEL_MATRIX, "UVMatrix": Shader.UV_MATRIX }, shadTexVertex, shadTexFrag);
            shad.getMatHandler().setUVMatrix(Matrix4.identity());
        }
        shad.getMatHandler().setModelMatrix(Matrix4.identity());
        shad.getMatHandler().setProjectionMatrix(Matrix4.identity());
        shad.getMatHandler().setViewMatrix(Matrix4.identity());
        return shad;
    }
    Plena.createShader = createShader;
    function manager() {
        return spriteManager;
    }
    Plena.manager = manager;
    function createManager() {
        return new Manager();
    }
    Plena.createManager = createManager;
    var Manager = (function () {
        function Manager() {
            this.shaders = new TreeMap(STRING_COMPARE);
            this.grixs = new DeepTreeMap(STRING_COMPARE);
        }
        Manager.prototype.hasShader = function (shader) {
            return this.shaders.contains(shader);
        };
        Manager.prototype.addShader = function (shader) {
            this.shaders.put(shader.getId(), shader);
        };
        Manager.prototype.getShader = function (key) {
            return this.shaders.apply(key);
        };
        Manager.prototype.addGrix = function (key, grix) {
            this.grixs.put((typeof key == "string") ? key : key.getId(), grix);
        };
        Manager.prototype.render = function () {
            var ittr = this.shaders.itterator();
            for (var i = 0; i < ittr.length; i++) {
                var entry = ittr[i];
                entry[1].bind();
                var grixs = this.grixs.itterator(entry[0]);
                for (var j = 0; j < grixs.length; j++) {
                    grixs[j].do_render();
                }
            }
        };
        return Manager;
    })();
})(Plena || (Plena = {}));
var GLF;
(function (GLF) {
    function clearBufferColor() {
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    GLF.clearBufferColor = clearBufferColor;
    function clearColor(color) {
        gl.clearColor(color[0], color[1], color[2], color[3]);
    }
    GLF.clearColor = clearColor;
    function viewPort(x, y, width, height) {
        gl.viewport(x, y, width, height);
    }
    GLF.viewPort = viewPort;
    function alphaBlend() {
        GLF.blend(true);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    GLF.alphaBlend = alphaBlend;
    function blend(enable) {
        if (enable)
            gl.enable(gl.BLEND);
        else
            gl.disable(gl.BLEND);
    }
    GLF.blend = blend;
})(GLF || (GLF = {}));
var Color = (function () {
    function Color() {
    }
    Color.toRGB = function (hex) {
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b;
        });
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
    };
    Color.componentToHex = function (c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    };
    Color.toHex = function (r, g, b) {
        return "#" + Color.componentToHex(r) + Color.componentToHex(g) + Color.componentToHex(b);
    };
    return Color;
})();
//# sourceMappingURL=plena.js.map