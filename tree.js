//Jacob Silveira
//CST-310
//7/27/2022

/*
I could not get the exact L-system implementation I made from class to operate the way I wanted the similarity
in the trees and positioning didnt make the trees look like an actual forest just fragmented spindles

the trees are still produced recursively with the branches splitting and rotating.
the math.random functions used in crating the parts of the tree generate a randomized forest at each run time, helping the forest feel more natural
*/


//creating shader
function Shader(src, type, gl) {
    this.id = gl.createShader(type);
    this.src = src;
    this.type = type;
    gl.shaderSource(this.id, src);
    gl.compileShader(this.id);
    if (!gl.getShaderParameter(this.id, gl.COMPILE_STATUS)) {
        console.error("GLSL ERROR: ", gl.getShaderInfoLog(this.id));
    }
}

//creating program and attaching shaders
function Program(fs_src, vs_src, gl) {
    this.id = gl.createProgram();
    this.gl = gl;
    this.attachShader(new Shader(fs_src, gl.FRAGMENT_SHADER, gl)); //fragment shader
    this.attachShader(new Shader(vs_src, gl.VERTEX_SHADER, gl)); //vertex shader
    gl.linkProgram(this.id); //link
    if (!gl.getProgramParameter(this.id, gl.LINK_STATUS))
        throw gl.getProgramInfoLog(this.id);
    ['pos', 'uv'].map(attr => {
        idx = gl.getAttribLocation(this.id, attr);
        if (idx >= 0) gl.enableVertexAttribArray(idx);
    });
}
Program.prototype.attachShader = function(p) { this.gl.attachShader(this.id, p.id) }; //webGLRenderingContext.attachShader() to attach shader
Program.prototype.enable = function() { this.gl.useProgram(this.id) };
Program.prototype.setPointer = function(name) {
    var args = [].slice.apply(arguments);
    args[0] = gl.getAttribLocation(this.id, name); //this.id returns elements ID
    gl.vertexAttribPointer.apply(gl, args);
}

//creating mesh from vertices and indices
function Mesh(vertices, indices, gl) {
    this.vertbuffer = gl.createBuffer();
    this.vertexcount = vertices.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertbuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    this.indexbuffer = gl.createBuffer();
    this.indexcount = indices.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexbuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    this.setPointers = function() {
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0); //sets attribute use to buffers
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    };
}

//drawing mesh
Program.prototype.drawMesh = function(m) {
    var gl = this.gl;
    this.enable();
    gl.uniform1f(gl.getUniformLocation(this.id, 't'), this.t);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vertbuffer); //to use buffer object with target set to array_buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.indexbuffer); //same for element_array_buffer
    m.setPointers();
    gl.drawElements(gl.TRIANGLES, m.indexcount, gl.UNSIGNED_SHORT, 0);
}

//creating a 4x4 matrix using Matrix4 from math.gl
//https://math.gl/modules/core/docs/api-reference/matrix4
function Matrix4(data) {this.data = data || [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
Matrix4.prototype.add = (o) => new Matrix4(this.data.map((x, i) => x + o.data[i]))
Matrix4.prototype.compose = function(o) {
    var data = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    for(var i=0; i<4; i++)
        for(var j=0; j<4; j++) {
            for(var n = 0; n < 4; n++) {
                data[i * 4 + j] += this.data[i * 4 + n] * o.data[n * 4 + j];
            }
        }
    return new Matrix4(data);
};

//matrix multiplication
Matrix4.prototype.transform = function(v) {
    var m = this.data;
    return [
        v[0]*m[1]+v[1]*m[4]+v[2]*m[8]+v[3]*m[12],
        v[0]*m[1]+v[1]*m[5]+v[2]*m[9]+v[3]*m[13],
        v[0]*m[2]+v[1]*m[6]+v[2]*m[10]+v[3]*m[14],
        v[0]*m[3]+v[1]*m[7]+v[2]*m[11]+v[3]*m[15]
    ];
};

//translating and making a new matrix
//matrix4.translate[x, y, z] during vector transformation the given translation values are added to each component of the vector to be transformed
Matrix4.translate = (x, y, z) => new Matrix4([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
Matrix4.scale = (x, y, z) => new Matrix4([x,0,0,0, 0,y,0,0, 0,0,z,0,0,0,0,1]);
Matrix4.rotateAxis = (th, x, y, z) => { //rotation
    var s = Math.sin(th), c = Math.cos(th), t = 1 - c;
    return new Matrix4([
        1+t*x*x-t, -z*s+t*x*y, y*s+t*x*z, 0,
        z*s+t*x*y, 1+t*y*y-t, -x*s+t*y*z, 0,
        -y*s+t*x*z, x*s+t*y*z, 1+t*z*z-t, 0,
        0, 0, 0, 1])};

function V3(x,y,z) { this.x = x; this.y = y; this.z = z }
V3.prototype.add = function(o) { return new V3(this.x+o.x, this.y + o.y, this.z+o.z) }
V3.prototype.sub = function(o) { return new V3(this.x-o.x, this.y-o.y, this.z-o.z) }
V3.prototype.mul = function(n) { return new V3(this.x*n, this.y*n, this.z*n) }

//translate, scale, and rotate
//rotateAxis gives successive rotations by given angles around x,y,z axis
//matrix4.scale lets each axis be scaled independently with size
var MOV=Matrix4.translate, SIZE=Matrix4.scale, ROT=Matrix4.rotateAxis
function _box(m, h, w, v, I, n, q) {
    if (n == 1) { h = w = 0.3; }
    var o = m.transform([0,0,0,1]);
    var dy = m.transform([0, h, 0, 0]);
    var dx = m.transform([w/2, 0, 0, 0]);
    var dz = m.transform([0, 0, w/2, 0.02]);
    var V = v.length/5, T = 0.8;
    for(var i = 0; i<2; i++)
        for(var j = 0; j<2; j++)
            for(var k = 0; k<2; k++) {
                _i = (1 - 0.15 * j) * i;
                _k = (1 - 0.15 * j) * k;
                v.push(
                    o[0] + _i * dx[0] + j * dy[0] + _k * dz[0],
                    o[1] + _i * dx[1] + j * dy[1] + _k * dz[1],
                    o[2] + _i * dx[2] + j * dy[2] + _k * dz[2], n, q);
            }
    I.push(
        V, V+1, V+2, V+2, V+1, V+3,
        V, V+1, V+4, V+4, V+1, V+5,
        V, V+2, V+4, V+4, V+2, V+6,
        V+7, V+6, V+5, V+5, V+6, V+4,
        V+7, V+6, V+3, V+3, V+6, V+2,
        V+7, V+5, V+3, V+3, V+5, V+1
    );
}



//base tree function
function Tree(X, F, gl) { //X and F parameters

    var v = [], i = [], q = Math.random();
    function _tree(X, F) {
        if (X === 0) return;
        //drawing branch level geometry based on L-system setup
        //to look more like real trees however as the branches increase in length the width needs to decrease
        var w =  0.01 * X + 0.02, h = 0.2 + Math.random() * 0.3; //branch size
        _box(F, h, w, v, i, X, q);

        //two smaller branches split recursively
        var size=0.85, th=0.60;
        var _x = Math.random(), _y = Math.random(), _z = Math.random();
        var _r = 1 / Math.sqrt(_x * _x + _y * _y + _z * _z);
        _x *= _r; _y *= _r; _z *= _r;
        _tree(X-1,ROT(th, _x, _y, _z) //rotate
            .compose(SIZE(size,size,size))
            .compose(MOV(0, h, 0))
            .compose(F), v, i);
        _tree(X-1,ROT(-th, _x, _y, _z) //rotate
            .compose(SIZE(size,size,size))
            .compose(MOV(0, h, 0))
            .compose(F), v, i);
    }
    _tree(X || 8, F || new Matrix4());
    return new Mesh(v, i, gl)
}

function dTree(main) {
    var gl = main.getContext('webgl');
    var X = new Tree(null, null, gl)
    var p = new Program(fshader.innerHTML, vshader.innerHTML, gl);
    var w = gl.canvas.width = document.body.clientWidth - 40;
    var h = gl.canvas.height = document.body.clientHeight - gl.canvas.offsetTop - 10;
    gl.viewport((w-h)/2, 0, h, h);
    trees = [];
    for(var i=0; i<15; i++) {
        s = 0.4 + 0.6 * Math.pow(Math.random(), 2); //size
        pos = MOV((i * 0.05) * Math.sin(i), 0, (i * 0.05) * Math.cos(i)) //movement speed
        trees.push(new Tree(12, SIZE(s,s,s).compose(pos), gl)); //x=tree count for making forest
    }
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    (function (t) {
        p.t = t;
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
        trees.map(i => p.drawMesh(i));
        requestAnimationFrame(arguments.callee);
    })();
}
dTree(main);


