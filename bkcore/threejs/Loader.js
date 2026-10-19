/*!
 * @class bkcore.threejs.Loader
 *
 * Loads multiple recources, get progress, callback friendly.
 * Supports textures, texturesCube, geometries, analysers, images.
 * 
 * @author Thibaut 'BKcore' Despoulain <http://bkcore.com>
 */

/*!
 * @package bkcore.threejs
 */
var bkcore = bkcore || {};
bkcore.threejs = bkcore.threejs || {};

bkcore.NONE = undefined;

/**
 * When hosted under /play/builds/<id>/ (Arcadizu), resolve assets to the public
 * storage URL so WebGL textures load reliably. Local serving stays relative.
 */
bkcore.threejs.resolveAssetUrl = function(url)
{
	if (!url || /^([a-z]+:)?\/\//i.test(url) || url.charAt(0) === 'data:') return url;
	try {
		var path = window.location.pathname || '';
		var m = path.match(/\/play\/builds\/([^/]+)\//);
		if (!m) return url;
		var base = 'https://azqwgoazoezkbexiiyoe.supabase.co/storage/v1/object/public/game-builds/builds/' + m[1] + '/';
		return base + String(url).replace(/^\.\//, '').replace(/^\//, '');
	} catch (e) {
		return url;
	}
};

/**
 * Creates a new loader
 * @param {Object{onLoad, onError, onProgress}} opts Callbacks
 */
bkcore.threejs.Loader = function(opts)
{
	var self = this;

	this.jsonLoader = new THREE.JSONLoader();

	this.errorCallback = opts.onError == undefined ? function(s){ console.warn("Error while loading %s.".replace("%s", s)) } : opts.onError;
	this.loadCallback = opts.onLoad == undefined ? function(){ console.log("Loaded.") } : opts.onLoad;
	this.progressCallback = opts.onProgress == undefined ? function(progress, type, name){ /**/ } : opts.onProgress;

	this.types = {
		textures: null,
		texturesCube: null,
		geometries: null,
		analysers: null,
		images: null,
		sounds: null
	};

	this.states = {};
	this.data = {};

	for(var t in this.types)
	{
		this.data[t] = {};
		this.states[t] = {};
	}

	this.progress = {
		total: 0,
		remaining: 0,
		loaded: 0,
		finished: false
	};
}

/**
 * Load the given list of resources
 * @param  {textures, texturesCube, geometries, analysers, images} data 
 */
bkcore.threejs.Loader.prototype.load = function(data)
{
	var self = this;

	for(var k in this.types)
	{
		if(k in data)
		{
			var size = 0;
			for(var j in data[k])
				size++;
			this.progress.total += size;
			this.progress.remaining += size;
		}
	}

	for(var t in data.textures)
		this.loadTexture(t, data.textures[t]);

	for(var c in data.texturesCube)
		this.loadTextureCube(c, data.texturesCube[c]);

	for(var g in data.geometries)
		this.loadGeometry(g, data.geometries[g]);

	for(var a in data.analysers)
		this.loadAnalyser(a, data.analysers[a]);

	for(var i in data.images)
		this.loadImage(i, data.images[i]);

	for(var s in data.sounds)
		this.loadSound(data.sounds[s].src, s, data.sounds[s].loop, data.sounds[s].usePanner);

	this.progressCallback.call(this, this.progress);
}

bkcore.threejs.Loader.prototype.updateState = function(type, name, state)
{
	if(!(type in this.types))
	{
		console.warn("Unkown loader type.");
		return;
	}

	if(state == true)
	{
		this.progress.remaining--;
		this.progress.loaded++;
		this.progressCallback.call(this, this.progress, type, name);
	}

	this.states[type][name] = state;


	if(this.progress.loaded == this.progress.total)
	{
		this.loadCallback.call(this);
	}
}

/**
 * Get loaded resource
 * @param  string type [textures, texturesCube, geometries, analysers, images]
 * @param  string name 
 * @return Mixed
 */
bkcore.threejs.Loader.prototype.get = function(type, name)
{
	if(!(type in this.types))
	{
		console.warn("Unkown loader type.");
		return null;
	}
	if(!(name in this.data[type]))
	{
		console.warn("Unkown file.");
		return null;
	}

	return this.data[type][name];
}

bkcore.threejs.Loader.prototype.loaded = function(type, name)
{
	if(!(type in this.types))
	{
		console.warn("Unkown loader type.");
		return null;
	}
	if(!(name in this.states[type]))
	{
		console.warn("Unkown file.");
		return null;
	}

	return this.states[type][name];
}

bkcore.threejs.Loader.prototype.loadTexture = function(name, url)
{
	var self = this;
	url = bkcore.threejs.resolveAssetUrl(url);
	this.updateState("textures", name, false);
	this.data.textures[name] = THREE.ImageUtils.loadTexture(
		url, 
		bkcore.NONE, 
		function(){ 
			self.updateState("textures", name, true); 
		}, 
		function(){ 
			self.errorCallback.call(self, name);
			self.updateState("textures", name, true);
		}
	);
}

bkcore.threejs.Loader.prototype.loadTextureCube = function(name, url)
{
	var self = this;
	url = bkcore.threejs.resolveAssetUrl(url);

	var urls = [
		url.replace("%1", "px"), url.replace("%1", "nx"),
		url.replace("%1", "py"), url.replace("%1", "ny"),
		url.replace("%1", "pz"), url.replace("%1", "nz")
	];

	this.updateState("texturesCube", name, false);
	// ImageUtils.loadTextureCube has no error path; failed faces would hang load forever.
	var images = [];
	images.loadCount = 0;
	var settled = false;
	var finish = function(ok) {
		if (settled) return;
		settled = true;
		if (!ok) self.errorCallback.call(self, name);
		self.updateState("texturesCube", name, true);
	};
	var texture = new THREE.Texture(images, new THREE.CubeRefractionMapping());
	texture.flipY = false;
	for (var i = 0; i < 6; i++) {
		(function (index) {
			var img = new Image();
			images[index] = img;
			img.onload = function () {
				images.loadCount++;
				if (images.loadCount === 6) {
					texture.needsUpdate = true;
					finish(true);
				}
			};
			img.onerror = function () { finish(false); };
			if (THREE.ImageUtils && THREE.ImageUtils.crossOrigin) {
				img.crossOrigin = THREE.ImageUtils.crossOrigin;
			}
			img.src = urls[index];
		})(i);
	}
	this.data.texturesCube[name] = texture;
}

bkcore.threejs.Loader.prototype.loadGeometry = function(name, url)
{
	var self = this;
	url = bkcore.threejs.resolveAssetUrl(url);
	this.data.geometries[name] = null;
	this.updateState("geometries", name, false);
	var settled = false;
	var finish = function(geom) {
		if (settled) return;
		settled = true;
		if (geom) self.data.geometries[name] = geom;
		else self.errorCallback.call(self, name);
		self.updateState("geometries", name, true);
	};
	try {
		this.jsonLoader.load(url, function(a){ finish(a); });
	} catch (err) {
		finish(null);
	}
	// Old JSONLoader has no onError; don't hang forever on 404/CORS.
	setTimeout(function(){
		if (!settled) finish(null);
	}, 60000);
}

bkcore.threejs.Loader.prototype.loadAnalyser = function(name, url)
{
	var self = this;
	url = bkcore.threejs.resolveAssetUrl(url);
	this.updateState("analysers", name, false);
	this.data.analysers[name] = new bkcore.ImageData(
		url, 
		function(){ 
			self.updateState("analysers", name, true);
		}
	);
}

bkcore.threejs.Loader.prototype.loadImage = function(name, url)
{
	var self = this;
	url = bkcore.threejs.resolveAssetUrl(url);
	this.updateState("images", name, false);
	var e = new Image();
	var done = false;
	var finish = function(ok) {
		if(done) return;
		done = true;
		if(!ok) self.errorCallback.call(self, name);
		self.updateState("images", name, true);
	};
	e.onload = function() { finish(true); };
	e.onerror = function() { finish(false); };
	if (THREE.ImageUtils && THREE.ImageUtils.crossOrigin) {
		e.crossOrigin = THREE.ImageUtils.crossOrigin;
	}
	e.src = url;
	this.data.images[name] = e;
}

bkcore.threejs.Loader.prototype.loadSound = function(src, name, loop){
    var self = this;
    src = bkcore.threejs.resolveAssetUrl(src);
    this.updateState("sounds", name, false);
    
    bkcore.Audio.addSound(
    	src,
    	name, 
    	loop, 
    	function(){
       	 self.updateState("sounds", name, true);
    	}
    );
    
    this.data.sounds[name] = {
        play: function(){
            bkcore.Audio.play(name);
        },
        stop: function(){
            bkcore.Audio.stop(name);
        },
        volume: function(vol){
            bkcore.Audio.volume(name, vol);
        }
    };
};