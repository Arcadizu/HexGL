 /*
 * HexGL
 * @author Thibaut 'BKcore' Despoulain <http://bkcore.com>
 * @license This work is licensed under the Creative Commons Attribution-NonCommercial 3.0 Unported License.
 *          To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/3.0/.
 */

'use strict';
'v1.0.1';

var bkcore = bkcore || {};
bkcore.hexgl = bkcore.hexgl || {};

bkcore.hexgl.HexGL = function(opts)
{
	var self = this;

	this.document = opts.document || document;

	this.a = window.location.href;

	this.active = true;
	this.displayHUD = opts.hud == undefined ? true : opts.hud;
	this.width = opts.width == undefined ? window.innerWidth : opts.width;
	this.height = opts.height == undefined ? window.innerHeight : opts.height;
	
	this.difficulty = opts.difficulty == undefined ? 0 : opts.difficulty;
	this.player = opts.player == undefined ? "Anonym" : opts.player;

	this.track = bkcore.hexgl.tracks[ opts.track == undefined ? 'Cityscape' : opts.track ];

	this.mode = opts.mode == undefined ? 'timeattack' : opts.mode;

	this.controlType = opts.controlType == undefined ? 1 : opts.controlType;
	
	// 0 == low, 1 == mid, 2 == high, 3 == very high
	// the old platform+quality combinations map to these new quality values
	// as follows:
	// mobile + low quality => 0 (LOW)
	// mobile + mid quality OR desktop + low quality => 1 (MID)
	// mobile + high quality => 2 (HIGH)
	// desktop + mid or high quality => 3 (VERY HIGH)
	this.quality = opts.quality == undefined ? 3 : opts.quality;

	if(this.quality === 0)
	{
		this.width /= 2;
		this.height /=2;
	}

	this.settings = null;
	this.renderer = null;
	this.manager = null;
	this.lib = null;
	this.materials = {};
	this.components = {};
	this.extras = {
		vignetteColor: new THREE.Color(0x458ab1),
		bloom: null,
		fxaa: null
	};

	this.containers = {};
	this.containers.main = opts.container == undefined ? document.body : opts.container;
	this.containers.overlay = opts.overlay == undefined ? document.body : opts.overlay;

	this.gameover = opts.gameover == undefined ? null : opts.gameover;

	this.godmode = opts.godmode == undefined ? false : opts.godmode;

	this.hud = null;

	this.gameplay = null;

	this.composers = {
		game: null
	};

	this.uiPaused = false;

	this.initRenderer();

	function onKeyPress(event)
	{
		if(event.keyCode == 27/*escape*/)
		{
			self.togglePause();
		}
	}

	this.document.addEventListener('keydown', onKeyPress, false);
}

bkcore.hexgl.HexGL.prototype.start = function()
{
	this.manager.setCurrent("game");
	this.initGameplay();
	this.kickRenderLoop();
}

bkcore.hexgl.HexGL.prototype.kickRenderLoop = function()
{
	var self = this;
	if(this._rafRunning) return;
	this._rafRunning = true;
	this.active = true;

	function raf()
	{
		if(!(self && self._rafRunning)) return;
		requestAnimationFrame(raf);
		if(self.active && !self.uiPaused)
			self.update();
		else if(self.uiPaused)
			self.manager.renderCurrent();
	}
	raf();
}

bkcore.hexgl.HexGL.prototype.stopRenderLoop = function()
{
	this._rafRunning = false;
	this.active = false;
}

bkcore.hexgl.HexGL.prototype.reset = function()
{
	this.uiPaused = false;
	this.active = true;
	this.manager.get('game').objects.lowFPS = 0;
	this.gameplay.start();

	bkcore.Audio.resume();
	bkcore.Audio.stop('bg');
	bkcore.Audio.stop('wind');
	bkcore.Audio.volume('wind', 0.35);
	bkcore.Audio.play('bg');
	bkcore.Audio.play('wind');
}

bkcore.hexgl.HexGL.prototype.restart = function()
{
	try{ this.document.getElementById('finish').style.display = 'none'; }
	catch(e){};
	this.hideFinishUI();
	this.hidePauseUI();
	this.reset();
	this.kickRenderLoop();
}

bkcore.hexgl.HexGL.prototype.togglePause = function()
{
	if(!this.gameplay || !this.active) return;
	if(this.gameplay.step >= 100) return;
	if(this.isFinishUIOpen()) return;

	if(this.uiPaused)
		this.resumeGame();
	else
		this.pauseGame();
}

bkcore.hexgl.HexGL.prototype.pauseGame = function()
{
	if(!this.gameplay || !this.gameplay.pause()) return;
	this.uiPaused = true;
	bkcore.Audio.suspend();
	this.showPauseUI();
}

bkcore.hexgl.HexGL.prototype.resumeGame = function()
{
	if(!this.gameplay) return;
	this.gameplay.resume();
	this.uiPaused = false;
	bkcore.Audio.resume();
	this.hidePauseUI();
}

bkcore.hexgl.HexGL.prototype.showPauseUI = function()
{
	var el = this.document.getElementById('pause-menu');
	if(el){
		el.classList.add('is-open');
		el.setAttribute('aria-hidden', 'false');
	}
}

bkcore.hexgl.HexGL.prototype.hidePauseUI = function()
{
	var el = this.document.getElementById('pause-menu');
	if(el){
		el.classList.remove('is-open');
		el.setAttribute('aria-hidden', 'true');
	}
}

bkcore.hexgl.HexGL.prototype.showFinishUI = function()
{
	var el = this.document.getElementById('finish-menu');
	if(el){
		el.classList.add('is-open');
		el.setAttribute('aria-hidden', 'false');
	}
}

bkcore.hexgl.HexGL.prototype.hideFinishUI = function()
{
	var el = this.document.getElementById('finish-menu');
	if(el){
		el.classList.remove('is-open');
		el.setAttribute('aria-hidden', 'true');
	}
}

bkcore.hexgl.HexGL.prototype.isFinishUIOpen = function()
{
	var el = this.document.getElementById('finish-menu');
	return !!(el && el.classList.contains('is-open'));
}

bkcore.hexgl.HexGL.prototype.formatRaceTime = function(ms)
{
	if(ms == null || isNaN(ms)) return "—";
	var t = bkcore.Timer.msToTimeString(ms);
	// msToTimeString zero-fills ms to 4 chars; show 3 for classic race feel
	var ms3 = ("" + (parseInt(t.ms, 10) % 1000)).replace(/^(\d+)$/, function(s){
		return ("000" + (parseInt(t.ms, 10) % 1000)).slice(-3);
	});
	return t.m + "'" + t.s + "''" + ms3;
}

bkcore.hexgl.HexGL.prototype.update = function()
{
	if(!this.active) return;

	if(this.gameplay != null)
		this.gameplay.update();

	this.manager.renderCurrent();
}

bkcore.hexgl.HexGL.prototype.init = function()
{
	this.initHUD();
	
	this.track.buildMaterials(this.quality);

	this.track.buildScenes(this, this.quality);

	this.initGameComposer();
}

bkcore.hexgl.HexGL.prototype.load = function(opts)
{
	this.track.load(opts, this.quality);
}

bkcore.hexgl.HexGL.prototype.initGameplay = function()
{
	var self = this;

	this.gameplay = new bkcore.hexgl.Gameplay({
		mode: this.mode,
		hud: this.hud,
		shipControls: this.components.shipControls,
		cameraControls: this.components.cameraChase,
		analyser: this.track.analyser,
		pixelRatio: this.track.pixelRatio,
		track: this.track,
		onFinish: function() {
			self.components.shipControls.terminate();
			self.displayScore(this.finishTime, this.lapTimes);
		}
	});

	this.gameplay.start();

	bkcore.Audio.play('bg');
	bkcore.Audio.play('wind');
	bkcore.Audio.volume('wind', 0.35);
}

bkcore.hexgl.HexGL.prototype.displayScore = function(f, l)
{
	this.active = false;
	this.uiPaused = false;
	this._rafRunning = false;
	this.hidePauseUI();
	bkcore.Audio.suspend();

	var trackKey = (this.track && this.track.name) ? this.track.name : 'Cityscape';
	var d = this.difficulty == 0 ? 'casual' : 'hard';
	var finished = this.gameplay.result == this.gameplay.results.FINISH;
	var isRecord = false;
	var note = finished ? "Solid run — can you go faster?" : "Ship destroyed. Try again.";

	if(finished && typeof Storage !== "undefined")
	{
		var key = 'score-' + trackKey + '-' + d;
		if(localStorage[key] == undefined || parseFloat(localStorage[key]) > f)
		{
			localStorage[key] = f;
			isRecord = true;
			note = "New personal best!";
			try {
				localStorage['race-' + trackKey + '-replay'] = JSON.stringify(this.gameplay.raceData.export());
			} catch (e) {}
		}
		else
		{
			note = "Best: " + this.formatRaceTime(parseFloat(localStorage[key]));
		}
	}

	var badge = this.document.getElementById('finish-badge');
	var title = this.document.getElementById('finish-title');
	var total = this.document.getElementById('finish-total');
	var l1 = this.document.getElementById('finish-l1');
	var l2 = this.document.getElementById('finish-l2');
	var l3 = this.document.getElementById('finish-l3');
	var noteEl = this.document.getElementById('finish-note');

	if(badge){
		badge.textContent = finished ? (isRecord ? "New record" : "Finished") : "Destroyed";
		badge.classList.toggle('is-bad', !finished);
	}
	if(title) title.textContent = finished ? "Race complete" : "Race over";
	if(total) total.textContent = finished ? this.formatRaceTime(f) : "—";
	if(l1) l1.textContent = this.formatRaceTime(l && l[0]);
	if(l2) l2.textContent = this.formatRaceTime(l && l[1]);
	if(l3) l3.textContent = this.formatRaceTime(l && l[2]);
	if(noteEl) noteEl.textContent = note;

	// keep game view visible behind the overlay
	this.showFinishUI();
}

bkcore.hexgl.HexGL.prototype.initRenderer = function()
{
	var renderer = new THREE.WebGLRenderer({
		antialias: false,
		alpha: false,
		stencil: false,
		preserveDrawingBuffer: false,
		failIfMajorPerformanceCaveat: false,
		clearColor: 0x000000
	});

	// desktop + quality mid or high
	if(this.quality > 2)
	{
		renderer.physicallyBasedShading = true;
		renderer.gammaInput = true;
		renderer.gammaOutput = true;
		renderer.shadowMapEnabled = true;
		renderer.shadowMapSoft = true;
	}

	renderer.autoClear = false;
	renderer.sortObjects = false;
	renderer.setSize( this.width, this.height );
	renderer.domElement.style.position = "absolute";
	renderer.domElement.style.left = "0";
	renderer.domElement.style.top = "0";
	renderer.domElement.style.width = "100%";
	renderer.domElement.style.height = "100%";

	this.containers.main.appendChild( renderer.domElement );
	this.canvas = renderer.domElement;
	this.renderer = renderer;
	this.manager = new bkcore.threejs.RenderManager(renderer);
}

bkcore.hexgl.HexGL.prototype.resize = function(w, h)
{
	w = w || window.innerWidth;
	h = h || window.innerHeight;
	if(w < 1 || h < 1) return;

	var renderW = w;
	var renderH = h;
	if(this.quality === 0)
	{
		renderW = Math.max(1, Math.floor(w / 2));
		renderH = Math.max(1, Math.floor(h / 2));
	}

	this.width = renderW;
	this.height = renderH;

	if(this.renderer)
	{
		this.renderer.setSize(renderW, renderH);
		if(this.canvas)
		{
			this.canvas.style.width = "100%";
			this.canvas.style.height = "100%";
		}
	}

	if(this.hud && this.hud.resize)
	{
		this.hud.resize(renderW, renderH);
		if(this.hud.canvas)
		{
			this.hud.canvas.style.width = "100%";
			this.hud.canvas.style.height = "100%";
		}
	}

	try {
		var game = this.manager.get("game");
		var sky = this.manager.get("sky");
		if(game && game.camera && game.camera.aspect !== undefined)
		{
			game.camera.aspect = renderW / renderH;
			game.camera.updateProjectionMatrix();
		}
		if(sky && sky.camera && sky.camera.aspect !== undefined)
		{
			sky.camera.aspect = renderW / renderH;
			sky.camera.updateProjectionMatrix();
		}
	} catch(e) {}

	if(this.composers && this.composers.game && typeof this.composers.game.reset === "function")
	{
		this.composers.game.reset();
	}

	if(this.extras && this.composers && this.composers.game)
	{
		var passes = this.composers.game.passes || [];
		for(var i = 0; i < passes.length; i++)
		{
			var pass = passes[i];
			if(pass && pass.uniforms)
			{
				if(pass.uniforms.size) pass.uniforms.size.value = 512.0 * (renderW / 1633);
				if(pass.uniforms.rx) pass.uniforms.rx.value = renderW;
				if(pass.uniforms.ry) pass.uniforms.ry.value = renderH;
				if(pass.uniforms.resolution) pass.uniforms.resolution.value.set(1 / renderW, 1 / renderH);
			}
		}
	}
}

bkcore.hexgl.HexGL.prototype.initHUD = function()
{
	if(!this.displayHUD) return;
	this.hud = new bkcore.hexgl.HUD({
		width: this.width,
		height: this.height,
		font: "BebasNeueRegular",
		bg: this.track.lib.get("images", "hud.bg"),
		speed: this.track.lib.get("images", "hud.speed"),
		shield: this.track.lib.get("images", "hud.shield")
	});
	this.containers.overlay.appendChild(this.hud.canvas);
	if(this.hud.canvas)
	{
		this.hud.canvas.style.position = "absolute";
		this.hud.canvas.style.left = "0";
		this.hud.canvas.style.top = "0";
		this.hud.canvas.style.width = "100%";
		this.hud.canvas.style.height = "100%";
	}
}

bkcore.hexgl.HexGL.prototype.initGameComposer = function()
{
	var renderTargetParameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false };
	var renderTarget = new THREE.WebGLRenderTarget( this.width, this.height, renderTargetParameters );

	// GAME COMPOSER
	var renderSky = new THREE.RenderPass( this.manager.get("sky").scene, this.manager.get("sky").camera );

	var renderModel = new THREE.RenderPass( this.manager.get("game").scene, this.manager.get("game").camera );
	renderModel.clear = false;

	this.composers.game = new THREE.EffectComposer( this.renderer, renderTarget );

	var effectScreen = new THREE.ShaderPass( THREE.ShaderExtras[ "screen" ] );
	effectScreen.renderToScreen = true;
	var effectVignette = new THREE.ShaderPass( THREE.ShaderExtras[ "vignette" ] );

	var effectHex = new THREE.ShaderPass( bkcore.threejs.Shaders[ "hexvignette" ] );
	effectHex.uniforms[ 'size' ].value = 512.0 * (this.width/1633);
	effectHex.uniforms[ 'rx' ].value = this.width;
	effectHex.uniforms[ 'ry' ].value = this.height;
	effectHex.uniforms[ 'tHex' ].texture = this.track.lib.get("textures", "hex");
	effectHex.uniforms[ 'color' ].value = this.extras.vignetteColor;

	effectHex.renderToScreen = true;

	this.composers.game.addPass( renderSky );
	this.composers.game.addPass( renderModel );

	// if(this.quality > 0 && !this.mobile)
	// {
	// 	var effectFXAA = new THREE.ShaderPass( THREE.ShaderExtras[ "fxaa" ] );
	// 	effectFXAA.uniforms[ 'resolution' ].value.set( 1 / this.width, 1 / this.height );

	// 	this.composers.game.addPass( effectFXAA );

	// 	this.extras.fxaa = effectFXAA;
	
	// }
	
	// desktop + quality mid or high
	if(this.quality > 2)
	{
		var effectBloom = new THREE.BloomPass( 0.8, 25, 4 , 256);

		this.composers.game.addPass( effectBloom );

		this.extras.bloom = effectBloom;
	}

	// desktop + quality low, mid or high
	// OR
	// mobile + quality mid or high
	if(this.quality > 0)
		this.composers.game.addPass( effectHex );
	else
		this.composers.game.addPass( effectScreen );
}

bkcore.hexgl.HexGL.prototype.createMesh = function(parent, geometry, x, y, z, mat)
{
	geometry.computeTangents();

	var mesh = new THREE.Mesh( geometry, mat );
	mesh.position.set( x, y, z );
	parent.add(mesh);

	// desktop + quality mid or high
	if(this.quality > 2)
	{
		mesh.castShadow = true;
		mesh.receiveShadow = true;
	}

	return mesh;
}

bkcore.hexgl.HexGL.prototype.tweakShipControls = function()
{
	var c = this.components.shipControls;
	if(this.difficulty == 1)
	{
		c.airResist = 0.035;
		c.airDrift = 0.07;
		c.thrust = 0.035;
		c.airBrake = 0.04;
		c.maxSpeed = 9.6;
		c.boosterSpeed = c.maxSpeed * 0.35;
		c.boosterDecay = 0.007;
		c.angularSpeed = 0.0140;
		c.airAngularSpeed = 0.0165;
		c.rollAngle = 0.6;
		c.shieldDamage = 0.03;
		c.collisionSpeedDecrease = 0.8;
		c.collisionSpeedDecreaseCoef = 0.5;
		c.rollLerp = 0.1;
		c.driftLerp = 0.4;
		c.angularLerp = 0.4;
	}
	else if(this.difficulty == 0)
	{
		c.airResist = 0.02;
		c.airDrift = 0.06;
		c.thrust = 0.02;
		c.airBrake = 0.025;
		c.maxSpeed = 7.0;
		c.boosterSpeed = c.maxSpeed * 0.5;
		c.boosterDecay = 0.007;
		c.angularSpeed = 0.0125;
		c.airAngularSpeed = 0.0135;
		c.rollAngle = 0.6;
		c.shieldDamage = 0.06;
		c.collisionSpeedDecrease = 0.8;
		c.collisionSpeedDecreaseCoef = 0.5;
		c.rollLerp = 0.07;
		c.driftLerp = 0.3;
		c.angularLerp = 0.4;
	}

	if(this.godmode)
		c.shieldDamage = 0.0;
}
