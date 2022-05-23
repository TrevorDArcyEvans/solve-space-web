var Module = typeof Module !== 'undefined' ? Module : {}
if (!Module.expectedDataFileDownloads) {
  Module.expectedDataFileDownloads = 0
  Module.finishedDataFileDownloads = 0
}
Module.expectedDataFileDownloads++
;(function () {
  var loadPackage = function (metadata) {
    var PACKAGE_PATH
    if (typeof window === 'object') {
      PACKAGE_PATH = window['encodeURIComponent'](
        window.location.pathname
          .toString()
          .substring(0, window.location.pathname.toString().lastIndexOf('/')) +
          '/'
      )
    } else if (typeof location !== 'undefined') {
      PACKAGE_PATH = encodeURIComponent(
        location.pathname
          .toString()
          .substring(0, location.pathname.toString().lastIndexOf('/')) + '/'
      )
    } else {
      throw 'using preloaded data can only be done on a web page or in a web worker'
    }
    var PACKAGE_NAME = '../bin/solvespace.data'
    var REMOTE_PACKAGE_BASE = 'solvespace.data'
    if (
      typeof Module['locateFilePackage'] === 'function' &&
      !Module['locateFile']
    ) {
      Module['locateFile'] = Module['locateFilePackage']
      err(
        'warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)'
      )
    }
    var REMOTE_PACKAGE_NAME = Module['locateFile']
      ? Module['locateFile'](REMOTE_PACKAGE_BASE, '')
      : REMOTE_PACKAGE_BASE
    var REMOTE_PACKAGE_SIZE = metadata.remote_package_size
    var PACKAGE_UUID = metadata.package_uuid
    function fetchRemotePackage (packageName, packageSize, callback, errback) {
      var xhr = new XMLHttpRequest()
      xhr.open('GET', packageName, true)
      xhr.responseType = 'arraybuffer'
      xhr.onprogress = function (event) {
        var url = packageName
        var size = packageSize
        if (event.total) size = event.total
        if (event.loaded) {
          if (!xhr.addedTotal) {
            xhr.addedTotal = true
            if (!Module.dataFileDownloads) Module.dataFileDownloads = {}
            Module.dataFileDownloads[url] = {
              loaded: event.loaded,
              total: size
            }
          } else {
            Module.dataFileDownloads[url].loaded = event.loaded
          }
          var total = 0
          var loaded = 0
          var num = 0
          for (var download in Module.dataFileDownloads) {
            var data = Module.dataFileDownloads[download]
            total += data.total
            loaded += data.loaded
            num++
          }
          total = Math.ceil((total * Module.expectedDataFileDownloads) / num)
          if (Module['setStatus'])
            Module['setStatus'](
              'Downloading data... (' + loaded + '/' + total + ')'
            )
        } else if (!Module.dataFileDownloads) {
          if (Module['setStatus']) Module['setStatus']('Downloading data...')
        }
      }
      xhr.onerror = function (event) {
        throw new Error('NetworkError for: ' + packageName)
      }
      xhr.onload = function (event) {
        if (
          xhr.status == 200 ||
          xhr.status == 304 ||
          xhr.status == 206 ||
          (xhr.status == 0 && xhr.response)
        ) {
          var packageData = xhr.response
          callback(packageData)
        } else {
          throw new Error(xhr.statusText + ' : ' + xhr.responseURL)
        }
      }
      xhr.send(null)
    }
    function handleError (error) {
      console.error('package error:', error)
    }
    var fetchedCallback = null
    var fetched = Module['getPreloadedPackage']
      ? Module['getPreloadedPackage'](REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE)
      : null
    if (!fetched)
      fetchRemotePackage(
        REMOTE_PACKAGE_NAME,
        REMOTE_PACKAGE_SIZE,
        function (data) {
          if (fetchedCallback) {
            fetchedCallback(data)
            fetchedCallback = null
          } else {
            fetched = data
          }
        },
        handleError
      )
    function runWithFS () {
      function assert (check, msg) {
        if (!check) throw msg + new Error().stack
      }
      Module['FS_createPath']('/', 'res', true, true)
      Module['FS_createPath']('/res', 'freedesktop', true, true)
      Module['FS_createPath']('/res', 'icons', true, true)
      Module['FS_createPath']('/res/icons', 'graphics-window', true, true)
      Module['FS_createPath']('/res/icons', 'text-window', true, true)
      Module['FS_createPath']('/res', 'locales', true, true)
      Module['FS_createPath']('/res', 'fonts', true, true)
      Module['FS_createPath']('/res/fonts', 'private', true, true)
      Module['FS_createPath']('/res', 'shaders', true, true)
      Module['FS_createPath']('/res', 'threejs', true, true)
      function DataRequest (start, end, audio) {
        this.start = start
        this.end = end
        this.audio = audio
      }
      DataRequest.prototype = {
        requests: {},
        open: function (mode, name) {
          this.name = name
          this.requests[name] = this
          Module['addRunDependency']('fp ' + this.name)
        },
        send: function () {},
        onload: function () {
          var byteArray = this.byteArray.subarray(this.start, this.end)
          this.finish(byteArray)
        },
        finish: function (byteArray) {
          var that = this
          Module['FS_createDataFile'](
            this.name,
            null,
            byteArray,
            true,
            true,
            true
          )
          Module['removeRunDependency']('fp ' + that.name)
          this.requests[this.name] = null
        }
      }
      var files = metadata.files
      for (var i = 0; i < files.length; ++i) {
        new DataRequest(files[i].start, files[i].end, files[i].audio).open(
          'GET',
          files[i].filename
        )
      }
      function processPackageData (arrayBuffer) {
        Module.finishedDataFileDownloads++
        assert(arrayBuffer, 'Loading data file failed.')
        assert(
          arrayBuffer instanceof ArrayBuffer,
          'bad input to processPackageData'
        )
        var byteArray = new Uint8Array(arrayBuffer)
        DataRequest.prototype.byteArray = byteArray
        var files = metadata.files
        for (var i = 0; i < files.length; ++i) {
          DataRequest.prototype.requests[files[i].filename].onload()
        }
        Module['removeRunDependency']('datafile_../bin/solvespace.data')
      }
      Module['addRunDependency']('datafile_../bin/solvespace.data')
      if (!Module.preloadResults) Module.preloadResults = {}
      Module.preloadResults[PACKAGE_NAME] = { fromCache: false }
      if (fetched) {
        processPackageData(fetched)
        fetched = null
      } else {
        fetchedCallback = processPackageData
      }
    }
    if (Module['calledRun']) {
      runWithFS()
    } else {
      if (!Module['preRun']) Module['preRun'] = []
      Module['preRun'].push(runWithFS)
    }
  }
  loadPackage({
    files: [
      {
        start: 0,
        audio: 0,
        end: 352,
        filename: '/res/freedesktop/solvespace-48x48.png'
      },
      { start: 352, audio: 0, end: 364, filename: '/res/banner.txt' },
      {
        start: 364,
        audio: 0,
        end: 1183,
        filename: '/res/icons/graphics-window/angle.png'
      },
      {
        start: 1183,
        audio: 0,
        end: 1869,
        filename: '/res/icons/graphics-window/arc.png'
      },
      {
        start: 1869,
        audio: 0,
        end: 2323,
        filename: '/res/icons/graphics-window/assemble.png'
      },
      {
        start: 2323,
        audio: 0,
        end: 3033,
        filename: '/res/icons/graphics-window/bezier.png'
      },
      {
        start: 3033,
        audio: 0,
        end: 3834,
        filename: '/res/icons/graphics-window/circle.png'
      },
      {
        start: 3834,
        audio: 0,
        end: 4573,
        filename: '/res/icons/graphics-window/construction.png'
      },
      {
        start: 4573,
        audio: 0,
        end: 5493,
        filename: '/res/icons/graphics-window/equal.png'
      },
      {
        start: 5493,
        audio: 0,
        end: 6113,
        filename: '/res/icons/graphics-window/extrude.png'
      },
      {
        start: 6113,
        audio: 0,
        end: 6531,
        filename: '/res/icons/graphics-window/horiz.png'
      },
      {
        start: 6531,
        audio: 0,
        end: 7556,
        filename: '/res/icons/graphics-window/image.png'
      },
      {
        start: 7556,
        audio: 0,
        end: 8068,
        filename: '/res/icons/graphics-window/in3d.png'
      },
      {
        start: 8068,
        audio: 0,
        end: 8469,
        filename: '/res/icons/graphics-window/lathe.png'
      },
      {
        start: 8469,
        audio: 0,
        end: 8949,
        filename: '/res/icons/graphics-window/length.png'
      },
      {
        start: 8949,
        audio: 0,
        end: 9460,
        filename: '/res/icons/graphics-window/line.png'
      },
      {
        start: 9460,
        audio: 0,
        end: 9872,
        filename: '/res/icons/graphics-window/ontoworkplane.png'
      },
      {
        start: 9872,
        audio: 0,
        end: 10788,
        filename: '/res/icons/graphics-window/other-supp.png'
      },
      {
        start: 10788,
        audio: 0,
        end: 11319,
        filename: '/res/icons/graphics-window/parallel.png'
      },
      {
        start: 11319,
        audio: 0,
        end: 11746,
        filename: '/res/icons/graphics-window/perpendicular.png'
      },
      {
        start: 11746,
        audio: 0,
        end: 12342,
        filename: '/res/icons/graphics-window/pointonx.png'
      },
      {
        start: 12342,
        audio: 0,
        end: 12736,
        filename: '/res/icons/graphics-window/point.png'
      },
      {
        start: 12736,
        audio: 0,
        end: 13154,
        filename: '/res/icons/graphics-window/rectangle.png'
      },
      {
        start: 13154,
        audio: 0,
        end: 13567,
        filename: '/res/icons/graphics-window/ref.png'
      },
      {
        start: 13567,
        audio: 0,
        end: 14240,
        filename: '/res/icons/graphics-window/same-orientation.png'
      },
      {
        start: 14240,
        audio: 0,
        end: 14837,
        filename: '/res/icons/graphics-window/sketch-in-3d.png'
      },
      {
        start: 14837,
        audio: 0,
        end: 15344,
        filename: '/res/icons/graphics-window/sketch-in-plane.png'
      },
      {
        start: 15344,
        audio: 0,
        end: 16215,
        filename: '/res/icons/graphics-window/step-rotate.png'
      },
      {
        start: 16215,
        audio: 0,
        end: 16626,
        filename: '/res/icons/graphics-window/step-translate.png'
      },
      {
        start: 16626,
        audio: 0,
        end: 17141,
        filename: '/res/icons/graphics-window/symmetric.png'
      },
      {
        start: 17141,
        audio: 0,
        end: 17807,
        filename: '/res/icons/graphics-window/tangent-arc.png'
      },
      {
        start: 17807,
        audio: 0,
        end: 18591,
        filename: '/res/icons/graphics-window/text.png'
      },
      {
        start: 18591,
        audio: 0,
        end: 19166,
        filename: '/res/icons/graphics-window/trim.png'
      },
      {
        start: 19166,
        audio: 0,
        end: 19681,
        filename: '/res/icons/graphics-window/vert.png'
      },
      {
        start: 19681,
        audio: 0,
        end: 20238,
        filename: '/res/icons/text-window/constraint.png'
      },
      {
        start: 20238,
        audio: 0,
        end: 20977,
        filename: '/res/icons/text-window/construction.png'
      },
      {
        start: 20977,
        audio: 0,
        end: 21680,
        filename: '/res/icons/text-window/edges.png'
      },
      {
        start: 21680,
        audio: 0,
        end: 22363,
        filename: '/res/icons/text-window/faces.png'
      },
      {
        start: 22363,
        audio: 0,
        end: 22728,
        filename: '/res/icons/text-window/occluded-visible.png'
      },
      {
        start: 22728,
        audio: 0,
        end: 23267,
        filename: '/res/icons/text-window/occluded-stippled.png'
      },
      {
        start: 23267,
        audio: 0,
        end: 23612,
        filename: '/res/icons/text-window/occluded-invisible.png'
      },
      {
        start: 23612,
        audio: 0,
        end: 24781,
        filename: '/res/icons/text-window/mesh.png'
      },
      {
        start: 24781,
        audio: 0,
        end: 25420,
        filename: '/res/icons/text-window/normal.png'
      },
      {
        start: 25420,
        audio: 0,
        end: 26153,
        filename: '/res/icons/text-window/outlines.png'
      },
      {
        start: 26153,
        audio: 0,
        end: 26547,
        filename: '/res/icons/text-window/point.png'
      },
      {
        start: 26547,
        audio: 0,
        end: 26950,
        filename: '/res/icons/text-window/shaded.png'
      },
      {
        start: 26950,
        audio: 0,
        end: 27412,
        filename: '/res/icons/text-window/workplane.png'
      },
      { start: 27412, audio: 0, end: 27682, filename: '/res/locales.txt' },
      { start: 27682, audio: 0, end: 77076, filename: '/res/locales/de_DE.po' },
      {
        start: 77076,
        audio: 0,
        end: 123143,
        filename: '/res/locales/en_US.po'
      },
      {
        start: 123143,
        audio: 0,
        end: 172467,
        filename: '/res/locales/fr_FR.po'
      },
      {
        start: 172467,
        audio: 0,
        end: 210054,
        filename: '/res/locales/uk_UA.po'
      },
      {
        start: 210054,
        audio: 0,
        end: 273507,
        filename: '/res/locales/ru_RU.po'
      },
      {
        start: 273507,
        audio: 0,
        end: 1232666,
        filename: '/res/fonts/unifont.hex.gz'
      },
      {
        start: 1232666,
        audio: 0,
        end: 1232884,
        filename: '/res/fonts/private/0-check-false.png'
      },
      {
        start: 1232884,
        audio: 0,
        end: 1233127,
        filename: '/res/fonts/private/1-check-true.png'
      },
      {
        start: 1233127,
        audio: 0,
        end: 1233355,
        filename: '/res/fonts/private/2-radio-false.png'
      },
      {
        start: 1233355,
        audio: 0,
        end: 1233586,
        filename: '/res/fonts/private/3-radio-true.png'
      },
      {
        start: 1233586,
        audio: 0,
        end: 1234522,
        filename: '/res/fonts/private/4-stipple-dot.png'
      },
      {
        start: 1234522,
        audio: 0,
        end: 1235454,
        filename: '/res/fonts/private/5-stipple-dash-long.png'
      },
      {
        start: 1235454,
        audio: 0,
        end: 1236386,
        filename: '/res/fonts/private/6-stipple-dash.png'
      },
      {
        start: 1236386,
        audio: 0,
        end: 1237336,
        filename: '/res/fonts/private/7-stipple-zigzag.png'
      },
      {
        start: 1237336,
        audio: 0,
        end: 1713310,
        filename: '/res/fonts/unicode.lff.gz'
      },
      {
        start: 1713310,
        audio: 0,
        end: 1767834,
        filename: '/res/fonts/BitstreamVeraSans-Roman-builtin.ttf'
      },
      {
        start: 1767834,
        audio: 0,
        end: 1768223,
        filename: '/res/shaders/imesh.frag'
      },
      {
        start: 1768223,
        audio: 0,
        end: 1768599,
        filename: '/res/shaders/imesh.vert'
      },
      {
        start: 1768599,
        audio: 0,
        end: 1768980,
        filename: '/res/shaders/imesh_point.frag'
      },
      {
        start: 1768980,
        audio: 0,
        end: 1770015,
        filename: '/res/shaders/imesh_point.vert'
      },
      {
        start: 1770015,
        audio: 0,
        end: 1770454,
        filename: '/res/shaders/imesh_tex.frag'
      },
      {
        start: 1770454,
        audio: 0,
        end: 1770857,
        filename: '/res/shaders/imesh_texa.frag'
      },
      {
        start: 1770857,
        audio: 0,
        end: 1771295,
        filename: '/res/shaders/imesh_tex.vert'
      },
      {
        start: 1771295,
        audio: 0,
        end: 1772093,
        filename: '/res/shaders/mesh.frag'
      },
      {
        start: 1772093,
        audio: 0,
        end: 1772624,
        filename: '/res/shaders/mesh.vert'
      },
      {
        start: 1772624,
        audio: 0,
        end: 1773013,
        filename: '/res/shaders/mesh_fill.frag'
      },
      {
        start: 1773013,
        audio: 0,
        end: 1773380,
        filename: '/res/shaders/mesh_fill.vert'
      },
      {
        start: 1773380,
        audio: 0,
        end: 1774417,
        filename: '/res/shaders/edge.frag'
      },
      {
        start: 1774417,
        audio: 0,
        end: 1775663,
        filename: '/res/shaders/edge.vert'
      },
      {
        start: 1775663,
        audio: 0,
        end: 1777618,
        filename: '/res/shaders/outline.vert'
      },
      {
        start: 1777618,
        audio: 0,
        end: 1967361,
        filename: '/res/threejs/three-r76.js.gz'
      },
      {
        start: 1967361,
        audio: 0,
        end: 1984864,
        filename: '/res/threejs/hammer-2.0.8.js.gz'
      },
      {
        start: 1984864,
        audio: 0,
        end: 2003949,
        filename: '/res/threejs/SolveSpaceControls.js'
      }
    ],
    remote_package_size: 2003949,
    package_uuid: '393cba3c-4181-474c-b13f-8ed46117fcaa'
  })
})()
var moduleOverrides = {}
var key
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key]
  }
}
var arguments_ = []
var thisProgram = './this.program'
var quit_ = function (status, toThrow) {
  throw toThrow
}
var ENVIRONMENT_IS_WEB = false
var ENVIRONMENT_IS_WORKER = false
var ENVIRONMENT_IS_NODE = false
var ENVIRONMENT_HAS_NODE = false
var ENVIRONMENT_IS_SHELL = false
ENVIRONMENT_IS_WEB = typeof window === 'object'
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function'
ENVIRONMENT_HAS_NODE =
  typeof process === 'object' &&
  typeof process.versions === 'object' &&
  typeof process.versions.node === 'string'
ENVIRONMENT_IS_NODE =
  ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER
ENVIRONMENT_IS_SHELL =
  !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER
var scriptDirectory = ''
function locateFile (path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory)
  }
  return scriptDirectory + path
}
var read_, readAsync, readBinary, setWindowTitle
if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/'
  var nodeFS
  var nodePath
  read_ = function shell_read (filename, binary) {
    var ret
    if (!nodeFS) nodeFS = require('fs')
    if (!nodePath) nodePath = require('path')
    filename = nodePath['normalize'](filename)
    ret = nodeFS['readFileSync'](filename)
    return binary ? ret : ret.toString()
  }
  readBinary = function readBinary (filename) {
    var ret = read_(filename, true)
    if (!ret.buffer) {
      ret = new Uint8Array(ret)
    }
    assert(ret.buffer)
    return ret
  }
  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/')
  }
  arguments_ = process['argv'].slice(2)
  if (typeof module !== 'undefined') {
    module['exports'] = Module
  }
  process['on']('uncaughtException', function (ex) {
    if (!(ex instanceof ExitStatus)) {
      throw ex
    }
  })
  process['on']('unhandledRejection', abort)
  quit_ = function (status) {
    process['exit'](status)
  }
  Module['inspect'] = function () {
    return '[Emscripten Module object]'
  }
} else if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != 'undefined') {
    read_ = function shell_read (f) {
      return read(f)
    }
  }
  readBinary = function readBinary (f) {
    var data
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f))
    }
    data = read(f, 'binary')
    assert(typeof data === 'object')
    return data
  }
  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments
  }
  if (typeof quit === 'function') {
    quit_ = function (status) {
      quit(status)
    }
  }
  if (typeof print !== 'undefined') {
    if (typeof console === 'undefined') console = {}
    console.log = print
    console.warn = console.error =
      typeof printErr !== 'undefined' ? printErr : print
  }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = self.location.href
  } else if (document.currentScript) {
    scriptDirectory = document.currentScript.src
  }
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(
      0,
      scriptDirectory.lastIndexOf('/') + 1
    )
  } else {
    scriptDirectory = ''
  }
  read_ = function shell_read (url) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', url, false)
    xhr.send(null)
    return xhr.responseText
  }
  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function readBinary (url) {
      var xhr = new XMLHttpRequest()
      xhr.open('GET', url, false)
      xhr.responseType = 'arraybuffer'
      xhr.send(null)
      return new Uint8Array(xhr.response)
    }
  }
  readAsync = function readAsync (url, onload, onerror) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'arraybuffer'
    xhr.onload = function xhr_onload () {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
        onload(xhr.response)
        return
      }
      onerror()
    }
    xhr.onerror = onerror
    xhr.send(null)
  }
  setWindowTitle = function (title) {
    document.title = title
  }
} else {
}
var out = Module['print'] || console.log.bind(console)
var err = Module['printErr'] || console.warn.bind(console)
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key]
  }
}
moduleOverrides = null
if (Module['arguments']) arguments_ = Module['arguments']
if (Module['thisProgram']) thisProgram = Module['thisProgram']
if (Module['quit']) quit_ = Module['quit']
var STACK_ALIGN = 16
function dynamicAlloc (size) {
  var ret = HEAP32[DYNAMICTOP_PTR >> 2]
  var end = (ret + size + 15) & -16
  if (end > _emscripten_get_heap_size()) {
    abort()
  }
  HEAP32[DYNAMICTOP_PTR >> 2] = end
  return ret
}
function getNativeTypeSize (type) {
  switch (type) {
    case 'i1':
    case 'i8':
      return 1
    case 'i16':
      return 2
    case 'i32':
      return 4
    case 'i64':
      return 8
    case 'float':
      return 4
    case 'double':
      return 8
    default: {
      if (type[type.length - 1] === '*') {
        return 4
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1))
        assert(
          bits % 8 === 0,
          'getNativeTypeSize invalid bits ' + bits + ', type ' + type
        )
        return bits / 8
      } else {
        return 0
      }
    }
  }
}
function warnOnce (text) {
  if (!warnOnce.shown) warnOnce.shown = {}
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1
    err(text)
  }
}
function convertJsFunctionToWasm (func, sig) {
  var typeSection = [1, 0, 1, 96]
  var sigRet = sig.slice(0, 1)
  var sigParam = sig.slice(1)
  var typeCodes = { i: 127, j: 126, f: 125, d: 124 }
  typeSection.push(sigParam.length)
  for (var i = 0; i < sigParam.length; ++i) {
    typeSection.push(typeCodes[sigParam[i]])
  }
  if (sigRet == 'v') {
    typeSection.push(0)
  } else {
    typeSection = typeSection.concat([1, typeCodes[sigRet]])
  }
  typeSection[1] = typeSection.length - 2
  var bytes = new Uint8Array(
    [0, 97, 115, 109, 1, 0, 0, 0].concat(typeSection, [
      2,
      7,
      1,
      1,
      101,
      1,
      102,
      0,
      0,
      7,
      5,
      1,
      1,
      102,
      0,
      0
    ])
  )
  var module = new WebAssembly.Module(bytes)
  var instance = new WebAssembly.Instance(module, { e: { f: func } })
  var wrappedFunc = instance.exports.f
  return wrappedFunc
}
function addFunctionWasm (func, sig) {
  var table = wasmTable
  var ret = table.length
  try {
    table.grow(1)
  } catch (err) {
    if (!err instanceof RangeError) {
      throw err
    }
    throw 'Unable to grow wasm table. Use a higher value for RESERVED_FUNCTION_POINTERS or set ALLOW_TABLE_GROWTH.'
  }
  try {
    table.set(ret, func)
  } catch (err) {
    if (!err instanceof TypeError) {
      throw err
    }
    assert(
      typeof sig !== 'undefined',
      'Missing signature argument to addFunction'
    )
    var wrapped = convertJsFunctionToWasm(func, sig)
    table.set(ret, wrapped)
  }
  return ret
}
function removeFunctionWasm (index) {}
var funcWrappers = {}
function getFuncWrapper (func, sig) {
  if (!func) return
  assert(sig)
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {}
  }
  var sigCache = funcWrappers[sig]
  if (!sigCache[func]) {
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper () {
        return dynCall(sig, func)
      }
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper (arg) {
        return dynCall(sig, func, [arg])
      }
    } else {
      sigCache[func] = function dynCall_wrapper () {
        return dynCall(sig, func, Array.prototype.slice.call(arguments))
      }
    }
  }
  return sigCache[func]
}
function dynCall (sig, ptr, args) {
  if (args && args.length) {
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args))
  } else {
    return Module['dynCall_' + sig].call(null, ptr)
  }
}
var tempRet0 = 0
var setTempRet0 = function (value) {
  tempRet0 = value
}
var getTempRet0 = function () {
  return tempRet0
}
var wasmBinary
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary']
var noExitRuntime
if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime']
if (typeof WebAssembly !== 'object') {
  err('no native wasm support detected')
}
function setValue (ptr, value, type, noSafe) {
  type = type || 'i8'
  if (type.charAt(type.length - 1) === '*') type = 'i32'
  switch (type) {
    case 'i1':
      HEAP8[ptr >> 0] = value
      break
    case 'i8':
      HEAP8[ptr >> 0] = value
      break
    case 'i16':
      HEAP16[ptr >> 1] = value
      break
    case 'i32':
      HEAP32[ptr >> 2] = value
      break
    case 'i64':
      ;(tempI64 = [
        value >>> 0,
        ((tempDouble = value),
        +Math_abs(tempDouble) >= 1
          ? tempDouble > 0
            ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) |
                0) >>>
              0
            : ~~+Math_ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
              ) >>> 0
          : 0)
      ]),
        (HEAP32[ptr >> 2] = tempI64[0]),
        (HEAP32[(ptr + 4) >> 2] = tempI64[1])
      break
    case 'float':
      HEAPF32[ptr >> 2] = value
      break
    case 'double':
      HEAPF64[ptr >> 3] = value
      break
    default:
      abort('invalid type for setValue: ' + type)
  }
}
var wasmMemory
var wasmTable = new WebAssembly.Table({
  initial: 1902,
  maximum: 1902 + 0,
  element: 'anyfunc'
})
var ABORT = false
var EXITSTATUS = 0
function assert (condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text)
  }
}
function getCFunc (ident) {
  var func = Module['_' + ident]
  assert(
    func,
    'Cannot call unknown function ' + ident + ', make sure it is exported'
  )
  return func
}
function ccall (ident, returnType, argTypes, args, opts) {
  var toC = {
    string: function (str) {
      var ret = 0
      if (str !== null && str !== undefined && str !== 0) {
        var len = (str.length << 2) + 1
        ret = stackAlloc(len)
        stringToUTF8(str, ret, len)
      }
      return ret
    },
    array: function (arr) {
      var ret = stackAlloc(arr.length)
      writeArrayToMemory(arr, ret)
      return ret
    }
  }
  function convertReturnValue (ret) {
    if (returnType === 'string') return UTF8ToString(ret)
    if (returnType === 'boolean') return Boolean(ret)
    return ret
  }
  var func = getCFunc(ident)
  var cArgs = []
  var stack = 0
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]]
      if (converter) {
        if (stack === 0) stack = stackSave()
        cArgs[i] = converter(args[i])
      } else {
        cArgs[i] = args[i]
      }
    }
  }
  var ret = func.apply(null, cArgs)
  ret = convertReturnValue(ret)
  if (stack !== 0) stackRestore(stack)
  return ret
}
var ALLOC_NORMAL = 0
var ALLOC_NONE = 3
function allocate (slab, types, allocator, ptr) {
  var zeroinit, size
  if (typeof slab === 'number') {
    zeroinit = true
    size = slab
  } else {
    zeroinit = false
    size = slab.length
  }
  var singleType = typeof types === 'string' ? types : null
  var ret
  if (allocator == ALLOC_NONE) {
    ret = ptr
  } else {
    ret = [_malloc, stackAlloc, dynamicAlloc][allocator](
      Math.max(size, singleType ? 1 : types.length)
    )
  }
  if (zeroinit) {
    var stop
    ptr = ret
    assert((ret & 3) == 0)
    stop = ret + (size & ~3)
    for (; ptr < stop; ptr += 4) {
      HEAP32[ptr >> 2] = 0
    }
    stop = ret + size
    while (ptr < stop) {
      HEAP8[ptr++ >> 0] = 0
    }
    return ret
  }
  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret)
    } else {
      HEAPU8.set(new Uint8Array(slab), ret)
    }
    return ret
  }
  var i = 0,
    type,
    typeSize,
    previousType
  while (i < size) {
    var curr = slab[i]
    type = singleType || types[i]
    if (type === 0) {
      i++
      continue
    }
    if (type == 'i64') type = 'i32'
    setValue(ret + i, curr, type)
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type)
      previousType = type
    }
    i += typeSize
  }
  return ret
}
function getMemory (size) {
  if (!runtimeInitialized) return dynamicAlloc(size)
  return _malloc(size)
}
function AsciiToString (ptr) {
  var str = ''
  while (1) {
    var ch = HEAPU8[ptr++ >> 0]
    if (!ch) return str
    str += String.fromCharCode(ch)
  }
}
var UTF8Decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined
function UTF8ArrayToString (u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead
  var endPtr = idx
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr
  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
  } else {
    var str = ''
    while (idx < endPtr) {
      var u0 = u8Array[idx++]
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0)
        continue
      }
      var u1 = u8Array[idx++] & 63
      if ((u0 & 224) == 192) {
        str += String.fromCharCode(((u0 & 31) << 6) | u1)
        continue
      }
      var u2 = u8Array[idx++] & 63
      if ((u0 & 240) == 224) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2
      } else {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63)
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0)
      } else {
        var ch = u0 - 65536
        str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023))
      }
    }
  }
  return str
}
function UTF8ToString (ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ''
}
function stringToUTF8Array (str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) return 0
  var startIdx = outIdx
  var endIdx = outIdx + maxBytesToWrite - 1
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i)
    if (u >= 55296 && u <= 57343) {
      var u1 = str.charCodeAt(++i)
      u = (65536 + ((u & 1023) << 10)) | (u1 & 1023)
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break
      outU8Array[outIdx++] = u
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break
      outU8Array[outIdx++] = 192 | (u >> 6)
      outU8Array[outIdx++] = 128 | (u & 63)
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break
      outU8Array[outIdx++] = 224 | (u >> 12)
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63)
      outU8Array[outIdx++] = 128 | (u & 63)
    } else {
      if (outIdx + 3 >= endIdx) break
      outU8Array[outIdx++] = 240 | (u >> 18)
      outU8Array[outIdx++] = 128 | ((u >> 12) & 63)
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63)
      outU8Array[outIdx++] = 128 | (u & 63)
    }
  }
  outU8Array[outIdx] = 0
  return outIdx - startIdx
}
function stringToUTF8 (str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
}
function lengthBytesUTF8 (str) {
  var len = 0
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i)
    if (u >= 55296 && u <= 57343)
      u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023)
    if (u <= 127) ++len
    else if (u <= 2047) len += 2
    else if (u <= 65535) len += 3
    else len += 4
  }
  return len
}
var UTF16Decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined
function allocateUTF8OnStack (str) {
  var size = lengthBytesUTF8(str) + 1
  var ret = stackAlloc(size)
  stringToUTF8Array(str, HEAP8, ret, size)
  return ret
}
function writeArrayToMemory (array, buffer) {
  HEAP8.set(array, buffer)
}
function writeAsciiToMemory (str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[buffer++ >> 0] = str.charCodeAt(i)
  }
  if (!dontAddNull) HEAP8[buffer >> 0] = 0
}
var WASM_PAGE_SIZE = 65536
function alignUp (x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple)
  }
  return x
}
var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64
function updateGlobalBufferAndViews (buf) {
  buffer = buf
  Module['HEAP8'] = HEAP8 = new Int8Array(buf)
  Module['HEAP16'] = HEAP16 = new Int16Array(buf)
  Module['HEAP32'] = HEAP32 = new Int32Array(buf)
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf)
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf)
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf)
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf)
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf)
}
var STACK_BASE = 34334864,
  DYNAMIC_BASE = 34334864,
  DYNAMICTOP_PTR = 780240
var INITIAL_TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 134217728
if (Module['wasmMemory']) {
  wasmMemory = Module['wasmMemory']
} else {
  wasmMemory = new WebAssembly.Memory({
    initial: INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
  })
}
if (wasmMemory) {
  buffer = wasmMemory.buffer
}
INITIAL_TOTAL_MEMORY = buffer.byteLength
updateGlobalBufferAndViews(buffer)
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE
function callRuntimeCallbacks (callbacks) {
  while (callbacks.length > 0) {
    var callback = callbacks.shift()
    if (typeof callback == 'function') {
      callback()
      continue
    }
    var func = callback.func
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func)
      } else {
        Module['dynCall_vi'](func, callback.arg)
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg)
    }
  }
}
var __ATPRERUN__ = []
var __ATINIT__ = []
var __ATMAIN__ = []
var __ATEXIT__ = []
var __ATPOSTRUN__ = []
var runtimeInitialized = false
var runtimeExited = false
function preRun () {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function')
      Module['preRun'] = [Module['preRun']]
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift())
    }
  }
  callRuntimeCallbacks(__ATPRERUN__)
}
function initRuntime () {
  runtimeInitialized = true
  if (!Module['noFSInit'] && !FS.init.initialized) FS.init()
  TTY.init()
  callRuntimeCallbacks(__ATINIT__)
}
function preMain () {
  FS.ignorePermissions = false
  callRuntimeCallbacks(__ATMAIN__)
}
function exitRuntime () {
  runtimeExited = true
}
function postRun () {
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function')
      Module['postRun'] = [Module['postRun']]
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift())
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__)
}
function addOnPreRun (cb) {
  __ATPRERUN__.unshift(cb)
}
function addOnPostRun (cb) {
  __ATPOSTRUN__.unshift(cb)
}
var Math_abs = Math.abs
var Math_ceil = Math.ceil
var Math_floor = Math.floor
var Math_min = Math.min
var runDependencies = 0
var runDependencyWatcher = null
var dependenciesFulfilled = null
function getUniqueRunDependency (id) {
  return id
}
function addRunDependency (id) {
  runDependencies++
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies)
  }
}
function removeRunDependency (id) {
  runDependencies--
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies)
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher)
      runDependencyWatcher = null
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled
      dependenciesFulfilled = null
      callback()
    }
  }
}
Module['preloadedImages'] = {}
Module['preloadedAudios'] = {}
function abort (what) {
  if (Module['onAbort']) {
    Module['onAbort'](what)
  }
  what += ''
  out(what)
  err(what)
  ABORT = true
  EXITSTATUS = 1
  throw 'abort(' + what + '). Build with -s ASSERTIONS=1 for more info.'
}
var dataURIPrefix = 'data:application/octet-stream;base64,'
function isDataURI (filename) {
  return String.prototype.startsWith
    ? filename.startsWith(dataURIPrefix)
    : filename.indexOf(dataURIPrefix) === 0
}
var wasmBinaryFile = 'solvespace.wasm'
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile)
}
function getBinary () {
  try {
    if (wasmBinary) {
      return new Uint8Array(wasmBinary)
    }
    if (readBinary) {
      return readBinary(wasmBinaryFile)
    } else {
      throw 'both async and sync fetching of the wasm failed'
    }
  } catch (err) {
    abort(err)
  }
}
function getBinaryPromise () {
  if (
    !wasmBinary &&
    (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) &&
    typeof fetch === 'function'
  ) {
    return fetch(wasmBinaryFile, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
        }
        return response['arrayBuffer']()
      })
      .catch(function () {
        return getBinary()
      })
  }
  return new Promise(function (resolve, reject) {
    resolve(getBinary())
  })
}
function createWasm () {
  var info = { env: asmLibraryArg, wasi_unstable: asmLibraryArg }
  function receiveInstance (instance, module) {
    var exports = instance.exports
    Module['asm'] = exports
    removeRunDependency('wasm-instantiate')
  }
  addRunDependency('wasm-instantiate')
  function receiveInstantiatedSource (output) {
    receiveInstance(output['instance'])
  }
  function instantiateArrayBuffer (receiver) {
    return getBinaryPromise()
      .then(function (binary) {
        return WebAssembly.instantiate(binary, info)
      })
      .then(receiver, function (reason) {
        err('failed to asynchronously prepare wasm: ' + reason)
        abort(reason)
      })
  }
  function instantiateAsync () {
    if (
      !wasmBinary &&
      typeof WebAssembly.instantiateStreaming === 'function' &&
      !isDataURI(wasmBinaryFile) &&
      typeof fetch === 'function'
    ) {
      fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (
        response
      ) {
        var result = WebAssembly.instantiateStreaming(response, info)
        return result.then(receiveInstantiatedSource, function (reason) {
          err('wasm streaming compile failed: ' + reason)
          err('falling back to ArrayBuffer instantiation')
          instantiateArrayBuffer(receiveInstantiatedSource)
        })
      })
    } else {
      return instantiateArrayBuffer(receiveInstantiatedSource)
    }
  }
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance)
      return exports
    } catch (e) {
      err('Module.instantiateWasm callback failed with error: ' + e)
      return false
    }
  }
  instantiateAsync()
  return {}
}
var tempDouble
var tempI64
var ASM_CONSTS = [
  function ($0) {
    $Wrap$ret = UTF8ToString($0)
  },
  function ($0, $1) {
    $Wrap$ret = Module.dynCall_vi.bind(null, $0, $1)
  },
  function () {
    return allocate($Wrap$input, 'i8', ALLOC_NORMAL)
  }
]
function _emscripten_asm_const_iii (code, sig_ptr, argbuf) {
  var sig = AsciiToString(sig_ptr)
  var args = []
  var align_to = function (ptr, align) {
    return (ptr + align - 1) & ~(align - 1)
  }
  var buf = argbuf
  for (var i = 0; i < sig.length; i++) {
    var c = sig[i]
    if (c == 'd' || c == 'f') {
      buf = align_to(buf, 8)
      args.push(HEAPF64[buf >> 3])
      buf += 8
    } else if (c == 'i') {
      buf = align_to(buf, 4)
      args.push(HEAP32[buf >> 2])
      buf += 4
    }
  }
  return ASM_CONSTS[code].apply(null, args)
}
__ATINIT__.push({
  func: function () {
    ___wasm_call_ctors()
  }
})
function demangle (func) {
  return func
}
function demangleAll (text) {
  var regex = /\b_Z[\w\d_]+/g
  return text.replace(regex, function (x) {
    var y = demangle(x)
    return x === y ? x : y + ' [' + x + ']'
  })
}
function jsStackTrace () {
  var err = new Error()
  if (!err.stack) {
    try {
      throw new Error(0)
    } catch (e) {
      err = e
    }
    if (!err.stack) {
      return '(no stack trace available)'
    }
  }
  return err.stack.toString()
}
function stackTrace () {
  var js = jsStackTrace()
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']()
  return demangleAll(js)
}
function ___cxa_allocate_exception (size) {
  return _malloc(size)
}
function _atexit (func, arg) {
  __ATEXIT__.unshift({ func: func, arg: arg })
}
function ___cxa_atexit () {
  return _atexit.apply(null, arguments)
}
var ___exception_infos = {}
var ___exception_last = 0
function ___cxa_throw (ptr, type, destructor) {
  ___exception_infos[ptr] = {
    ptr: ptr,
    adjusted: [ptr],
    type: type,
    destructor: destructor,
    refcount: 0,
    caught: false,
    rethrown: false
  }
  ___exception_last = ptr
  if (!('uncaught_exception' in __ZSt18uncaught_exceptionv)) {
    __ZSt18uncaught_exceptionv.uncaught_exceptions = 1
  } else {
    __ZSt18uncaught_exceptionv.uncaught_exceptions++
  }
  throw ptr
}
function ___lock () {}
function ___setErrNo (value) {
  if (Module['___errno_location'])
    HEAP32[Module['___errno_location']() >> 2] = value
  return value
}
function ___map_file (pathname, size) {
  ___setErrNo(1)
  return -1
}
var PATH = {
  splitPath: function (filename) {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/
    return splitPathRe.exec(filename).slice(1)
  },
  normalizeArray: function (parts, allowAboveRoot) {
    var up = 0
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i]
      if (last === '.') {
        parts.splice(i, 1)
      } else if (last === '..') {
        parts.splice(i, 1)
        up++
      } else if (up) {
        parts.splice(i, 1)
        up--
      }
    }
    if (allowAboveRoot) {
      for (; up; up--) {
        parts.unshift('..')
      }
    }
    return parts
  },
  normalize: function (path) {
    var isAbsolute = path.charAt(0) === '/',
      trailingSlash = path.substr(-1) === '/'
    path = PATH.normalizeArray(
      path.split('/').filter(function (p) {
        return !!p
      }),
      !isAbsolute
    ).join('/')
    if (!path && !isAbsolute) {
      path = '.'
    }
    if (path && trailingSlash) {
      path += '/'
    }
    return (isAbsolute ? '/' : '') + path
  },
  dirname: function (path) {
    var result = PATH.splitPath(path),
      root = result[0],
      dir = result[1]
    if (!root && !dir) {
      return '.'
    }
    if (dir) {
      dir = dir.substr(0, dir.length - 1)
    }
    return root + dir
  },
  basename: function (path) {
    if (path === '/') return '/'
    var lastSlash = path.lastIndexOf('/')
    if (lastSlash === -1) return path
    return path.substr(lastSlash + 1)
  },
  extname: function (path) {
    return PATH.splitPath(path)[3]
  },
  join: function () {
    var paths = Array.prototype.slice.call(arguments, 0)
    return PATH.normalize(paths.join('/'))
  },
  join2: function (l, r) {
    return PATH.normalize(l + '/' + r)
  }
}
var PATH_FS = {
  resolve: function () {
    var resolvedPath = '',
      resolvedAbsolute = false
    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = i >= 0 ? arguments[i] : FS.cwd()
      if (typeof path !== 'string') {
        throw new TypeError('Arguments to path.resolve must be strings')
      } else if (!path) {
        return ''
      }
      resolvedPath = path + '/' + resolvedPath
      resolvedAbsolute = path.charAt(0) === '/'
    }
    resolvedPath = PATH.normalizeArray(
      resolvedPath.split('/').filter(function (p) {
        return !!p
      }),
      !resolvedAbsolute
    ).join('/')
    return (resolvedAbsolute ? '/' : '') + resolvedPath || '.'
  },
  relative: function (from, to) {
    from = PATH_FS.resolve(from).substr(1)
    to = PATH_FS.resolve(to).substr(1)
    function trim (arr) {
      var start = 0
      for (; start < arr.length; start++) {
        if (arr[start] !== '') break
      }
      var end = arr.length - 1
      for (; end >= 0; end--) {
        if (arr[end] !== '') break
      }
      if (start > end) return []
      return arr.slice(start, end - start + 1)
    }
    var fromParts = trim(from.split('/'))
    var toParts = trim(to.split('/'))
    var length = Math.min(fromParts.length, toParts.length)
    var samePartsLength = length
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i
        break
      }
    }
    var outputParts = []
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push('..')
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength))
    return outputParts.join('/')
  }
}
var TTY = {
  ttys: [],
  init: function () {},
  shutdown: function () {},
  register: function (dev, ops) {
    TTY.ttys[dev] = { input: [], output: [], ops: ops }
    FS.registerDevice(dev, TTY.stream_ops)
  },
  stream_ops: {
    open: function (stream) {
      var tty = TTY.ttys[stream.node.rdev]
      if (!tty) {
        throw new FS.ErrnoError(19)
      }
      stream.tty = tty
      stream.seekable = false
    },
    close: function (stream) {
      stream.tty.ops.flush(stream.tty)
    },
    flush: function (stream) {
      stream.tty.ops.flush(stream.tty)
    },
    read: function (stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(6)
      }
      var bytesRead = 0
      for (var i = 0; i < length; i++) {
        var result
        try {
          result = stream.tty.ops.get_char(stream.tty)
        } catch (e) {
          throw new FS.ErrnoError(5)
        }
        if (result === undefined && bytesRead === 0) {
          throw new FS.ErrnoError(11)
        }
        if (result === null || result === undefined) break
        bytesRead++
        buffer[offset + i] = result
      }
      if (bytesRead) {
        stream.node.timestamp = Date.now()
      }
      return bytesRead
    },
    write: function (stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(6)
      }
      try {
        for (var i = 0; i < length; i++) {
          stream.tty.ops.put_char(stream.tty, buffer[offset + i])
        }
      } catch (e) {
        throw new FS.ErrnoError(5)
      }
      if (length) {
        stream.node.timestamp = Date.now()
      }
      return i
    }
  },
  default_tty_ops: {
    get_char: function (tty) {
      if (!tty.input.length) {
        var result = null
        if (ENVIRONMENT_IS_NODE) {
          var BUFSIZE = 256
          var buf = Buffer.alloc ? Buffer.alloc(BUFSIZE) : new Buffer(BUFSIZE)
          var bytesRead = 0
          try {
            bytesRead = fs.readSync(process.stdin.fd, buf, 0, BUFSIZE, null)
          } catch (e) {
            if (e.toString().indexOf('EOF') != -1) bytesRead = 0
            else throw e
          }
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString('utf-8')
          } else {
            result = null
          }
        } else if (
          typeof window != 'undefined' &&
          typeof window.prompt == 'function'
        ) {
          result = window.prompt('Input: ')
          if (result !== null) {
            result += '\n'
          }
        } else if (typeof readline == 'function') {
          result = readline()
          if (result !== null) {
            result += '\n'
          }
        }
        if (!result) {
          return null
        }
        tty.input = intArrayFromString(result, true)
      }
      return tty.input.shift()
    },
    put_char: function (tty, val) {
      if (val === null || val === 10) {
        out(UTF8ArrayToString(tty.output, 0))
        tty.output = []
      } else {
        if (val != 0) tty.output.push(val)
      }
    },
    flush: function (tty) {
      if (tty.output && tty.output.length > 0) {
        out(UTF8ArrayToString(tty.output, 0))
        tty.output = []
      }
    }
  },
  default_tty1_ops: {
    put_char: function (tty, val) {
      if (val === null || val === 10) {
        err(UTF8ArrayToString(tty.output, 0))
        tty.output = []
      } else {
        if (val != 0) tty.output.push(val)
      }
    },
    flush: function (tty) {
      if (tty.output && tty.output.length > 0) {
        err(UTF8ArrayToString(tty.output, 0))
        tty.output = []
      }
    }
  }
}
var MEMFS = {
  ops_table: null,
  mount: function (mount) {
    return MEMFS.createNode(null, '/', 16384 | 511, 0)
  },
  createNode: function (parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      throw new FS.ErrnoError(1)
    }
    if (!MEMFS.ops_table) {
      MEMFS.ops_table = {
        dir: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            lookup: MEMFS.node_ops.lookup,
            mknod: MEMFS.node_ops.mknod,
            rename: MEMFS.node_ops.rename,
            unlink: MEMFS.node_ops.unlink,
            rmdir: MEMFS.node_ops.rmdir,
            readdir: MEMFS.node_ops.readdir,
            symlink: MEMFS.node_ops.symlink
          },
          stream: { llseek: MEMFS.stream_ops.llseek }
        },
        file: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr
          },
          stream: {
            llseek: MEMFS.stream_ops.llseek,
            read: MEMFS.stream_ops.read,
            write: MEMFS.stream_ops.write,
            allocate: MEMFS.stream_ops.allocate,
            mmap: MEMFS.stream_ops.mmap,
            msync: MEMFS.stream_ops.msync
          }
        },
        link: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            readlink: MEMFS.node_ops.readlink
          },
          stream: {}
        },
        chrdev: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr
          },
          stream: FS.chrdev_stream_ops
        }
      }
    }
    var node = FS.createNode(parent, name, mode, dev)
    if (FS.isDir(node.mode)) {
      node.node_ops = MEMFS.ops_table.dir.node
      node.stream_ops = MEMFS.ops_table.dir.stream
      node.contents = {}
    } else if (FS.isFile(node.mode)) {
      node.node_ops = MEMFS.ops_table.file.node
      node.stream_ops = MEMFS.ops_table.file.stream
      node.usedBytes = 0
      node.contents = null
    } else if (FS.isLink(node.mode)) {
      node.node_ops = MEMFS.ops_table.link.node
      node.stream_ops = MEMFS.ops_table.link.stream
    } else if (FS.isChrdev(node.mode)) {
      node.node_ops = MEMFS.ops_table.chrdev.node
      node.stream_ops = MEMFS.ops_table.chrdev.stream
    }
    node.timestamp = Date.now()
    if (parent) {
      parent.contents[name] = node
    }
    return node
  },
  getFileDataAsRegularArray: function (node) {
    if (node.contents && node.contents.subarray) {
      var arr = []
      for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i])
      return arr
    }
    return node.contents
  },
  getFileDataAsTypedArray: function (node) {
    if (!node.contents) return new Uint8Array()
    if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes)
    return new Uint8Array(node.contents)
  },
  expandFileStorage: function (node, newCapacity) {
    var prevCapacity = node.contents ? node.contents.length : 0
    if (prevCapacity >= newCapacity) return
    var CAPACITY_DOUBLING_MAX = 1024 * 1024
    newCapacity = Math.max(
      newCapacity,
      (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) | 0
    )
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256)
    var oldContents = node.contents
    node.contents = new Uint8Array(newCapacity)
    if (node.usedBytes > 0)
      node.contents.set(oldContents.subarray(0, node.usedBytes), 0)
    return
  },
  resizeFileStorage: function (node, newSize) {
    if (node.usedBytes == newSize) return
    if (newSize == 0) {
      node.contents = null
      node.usedBytes = 0
      return
    }
    if (!node.contents || node.contents.subarray) {
      var oldContents = node.contents
      node.contents = new Uint8Array(new ArrayBuffer(newSize))
      if (oldContents) {
        node.contents.set(
          oldContents.subarray(0, Math.min(newSize, node.usedBytes))
        )
      }
      node.usedBytes = newSize
      return
    }
    if (!node.contents) node.contents = []
    if (node.contents.length > newSize) node.contents.length = newSize
    else while (node.contents.length < newSize) node.contents.push(0)
    node.usedBytes = newSize
  },
  node_ops: {
    getattr: function (node) {
      var attr = {}
      attr.dev = FS.isChrdev(node.mode) ? node.id : 1
      attr.ino = node.id
      attr.mode = node.mode
      attr.nlink = 1
      attr.uid = 0
      attr.gid = 0
      attr.rdev = node.rdev
      if (FS.isDir(node.mode)) {
        attr.size = 4096
      } else if (FS.isFile(node.mode)) {
        attr.size = node.usedBytes
      } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length
      } else {
        attr.size = 0
      }
      attr.atime = new Date(node.timestamp)
      attr.mtime = new Date(node.timestamp)
      attr.ctime = new Date(node.timestamp)
      attr.blksize = 4096
      attr.blocks = Math.ceil(attr.size / attr.blksize)
      return attr
    },
    setattr: function (node, attr) {
      if (attr.mode !== undefined) {
        node.mode = attr.mode
      }
      if (attr.timestamp !== undefined) {
        node.timestamp = attr.timestamp
      }
      if (attr.size !== undefined) {
        MEMFS.resizeFileStorage(node, attr.size)
      }
    },
    lookup: function (parent, name) {
      throw FS.genericErrors[2]
    },
    mknod: function (parent, name, mode, dev) {
      return MEMFS.createNode(parent, name, mode, dev)
    },
    rename: function (old_node, new_dir, new_name) {
      if (FS.isDir(old_node.mode)) {
        var new_node
        try {
          new_node = FS.lookupNode(new_dir, new_name)
        } catch (e) {}
        if (new_node) {
          for (var i in new_node.contents) {
            throw new FS.ErrnoError(39)
          }
        }
      }
      delete old_node.parent.contents[old_node.name]
      old_node.name = new_name
      new_dir.contents[new_name] = old_node
      old_node.parent = new_dir
    },
    unlink: function (parent, name) {
      delete parent.contents[name]
    },
    rmdir: function (parent, name) {
      var node = FS.lookupNode(parent, name)
      for (var i in node.contents) {
        throw new FS.ErrnoError(39)
      }
      delete parent.contents[name]
    },
    readdir: function (node) {
      var entries = ['.', '..']
      for (var key in node.contents) {
        if (!node.contents.hasOwnProperty(key)) {
          continue
        }
        entries.push(key)
      }
      return entries
    },
    symlink: function (parent, newname, oldpath) {
      var node = MEMFS.createNode(parent, newname, 511 | 40960, 0)
      node.link = oldpath
      return node
    },
    readlink: function (node) {
      if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(22)
      }
      return node.link
    }
  },
  stream_ops: {
    read: function (stream, buffer, offset, length, position) {
      var contents = stream.node.contents
      if (position >= stream.node.usedBytes) return 0
      var size = Math.min(stream.node.usedBytes - position, length)
      if (size > 8 && contents.subarray) {
        buffer.set(contents.subarray(position, position + size), offset)
      } else {
        for (var i = 0; i < size; i++)
          buffer[offset + i] = contents[position + i]
      }
      return size
    },
    write: function (stream, buffer, offset, length, position, canOwn) {
      canOwn = false
      if (!length) return 0
      var node = stream.node
      node.timestamp = Date.now()
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        if (canOwn) {
          node.contents = buffer.subarray(offset, offset + length)
          node.usedBytes = length
          return length
        } else if (node.usedBytes === 0 && position === 0) {
          node.contents = new Uint8Array(
            buffer.subarray(offset, offset + length)
          )
          node.usedBytes = length
          return length
        } else if (position + length <= node.usedBytes) {
          node.contents.set(buffer.subarray(offset, offset + length), position)
          return length
        }
      }
      MEMFS.expandFileStorage(node, position + length)
      if (node.contents.subarray && buffer.subarray)
        node.contents.set(buffer.subarray(offset, offset + length), position)
      else {
        for (var i = 0; i < length; i++) {
          node.contents[position + i] = buffer[offset + i]
        }
      }
      node.usedBytes = Math.max(node.usedBytes, position + length)
      return length
    },
    llseek: function (stream, offset, whence) {
      var position = offset
      if (whence === 1) {
        position += stream.position
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.usedBytes
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(22)
      }
      return position
    },
    allocate: function (stream, offset, length) {
      MEMFS.expandFileStorage(stream.node, offset + length)
      stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
    },
    mmap: function (stream, buffer, offset, length, position, prot, flags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(19)
      }
      var ptr
      var allocated
      var contents = stream.node.contents
      if (
        !(flags & 2) &&
        (contents.buffer === buffer || contents.buffer === buffer.buffer)
      ) {
        allocated = false
        ptr = contents.byteOffset
      } else {
        if (position > 0 || position + length < stream.node.usedBytes) {
          if (contents.subarray) {
            contents = contents.subarray(position, position + length)
          } else {
            contents = Array.prototype.slice.call(
              contents,
              position,
              position + length
            )
          }
        }
        allocated = true
        var fromHeap = buffer.buffer == HEAP8.buffer
        ptr = _malloc(length)
        if (!ptr) {
          throw new FS.ErrnoError(12)
        }
        ;(fromHeap ? HEAP8 : buffer).set(contents, ptr)
      }
      return { ptr: ptr, allocated: allocated }
    },
    msync: function (stream, buffer, offset, length, mmapFlags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(19)
      }
      if (mmapFlags & 2) {
        return 0
      }
      var bytesWritten = MEMFS.stream_ops.write(
        stream,
        buffer,
        0,
        length,
        offset,
        false
      )
      return 0
    }
  }
}
var IDBFS = {
  dbs: {},
  indexedDB: function () {
    if (typeof indexedDB !== 'undefined') return indexedDB
    var ret = null
    if (typeof window === 'object')
      ret =
        window.indexedDB ||
        window.mozIndexedDB ||
        window.webkitIndexedDB ||
        window.msIndexedDB
    assert(ret, 'IDBFS used, but indexedDB not supported')
    return ret
  },
  DB_VERSION: 21,
  DB_STORE_NAME: 'FILE_DATA',
  mount: function (mount) {
    return MEMFS.mount.apply(null, arguments)
  },
  syncfs: function (mount, populate, callback) {
    IDBFS.getLocalSet(mount, function (err, local) {
      if (err) return callback(err)
      IDBFS.getRemoteSet(mount, function (err, remote) {
        if (err) return callback(err)
        var src = populate ? remote : local
        var dst = populate ? local : remote
        IDBFS.reconcile(src, dst, callback)
      })
    })
  },
  getDB: function (name, callback) {
    var db = IDBFS.dbs[name]
    if (db) {
      return callback(null, db)
    }
    var req
    try {
      req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION)
    } catch (e) {
      return callback(e)
    }
    if (!req) {
      return callback('Unable to connect to IndexedDB')
    }
    req.onupgradeneeded = function (e) {
      var db = e.target.result
      var transaction = e.target.transaction
      var fileStore
      if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
        fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME)
      } else {
        fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME)
      }
      if (!fileStore.indexNames.contains('timestamp')) {
        fileStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
    req.onsuccess = function () {
      db = req.result
      IDBFS.dbs[name] = db
      callback(null, db)
    }
    req.onerror = function (e) {
      callback(this.error)
      e.preventDefault()
    }
  },
  getLocalSet: function (mount, callback) {
    var entries = {}
    function isRealDir (p) {
      return p !== '.' && p !== '..'
    }
    function toAbsolute (root) {
      return function (p) {
        return PATH.join2(root, p)
      }
    }
    var check = FS.readdir(mount.mountpoint)
      .filter(isRealDir)
      .map(toAbsolute(mount.mountpoint))
    while (check.length) {
      var path = check.pop()
      var stat
      try {
        stat = FS.stat(path)
      } catch (e) {
        return callback(e)
      }
      if (FS.isDir(stat.mode)) {
        check.push.apply(
          check,
          FS.readdir(path)
            .filter(isRealDir)
            .map(toAbsolute(path))
        )
      }
      entries[path] = { timestamp: stat.mtime }
    }
    return callback(null, { type: 'local', entries: entries })
  },
  getRemoteSet: function (mount, callback) {
    var entries = {}
    IDBFS.getDB(mount.mountpoint, function (err, db) {
      if (err) return callback(err)
      try {
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly')
        transaction.onerror = function (e) {
          callback(this.error)
          e.preventDefault()
        }
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME)
        var index = store.index('timestamp')
        index.openKeyCursor().onsuccess = function (event) {
          var cursor = event.target.result
          if (!cursor) {
            return callback(null, { type: 'remote', db: db, entries: entries })
          }
          entries[cursor.primaryKey] = { timestamp: cursor.key }
          cursor.continue()
        }
      } catch (e) {
        return callback(e)
      }
    })
  },
  loadLocalEntry: function (path, callback) {
    var stat, node
    try {
      var lookup = FS.lookupPath(path)
      node = lookup.node
      stat = FS.stat(path)
    } catch (e) {
      return callback(e)
    }
    if (FS.isDir(stat.mode)) {
      return callback(null, { timestamp: stat.mtime, mode: stat.mode })
    } else if (FS.isFile(stat.mode)) {
      node.contents = MEMFS.getFileDataAsTypedArray(node)
      return callback(null, {
        timestamp: stat.mtime,
        mode: stat.mode,
        contents: node.contents
      })
    } else {
      return callback(new Error('node type not supported'))
    }
  },
  storeLocalEntry: function (path, entry, callback) {
    try {
      if (FS.isDir(entry.mode)) {
        FS.mkdir(path, entry.mode)
      } else if (FS.isFile(entry.mode)) {
        FS.writeFile(path, entry.contents, { canOwn: true })
      } else {
        return callback(new Error('node type not supported'))
      }
      FS.chmod(path, entry.mode)
      FS.utime(path, entry.timestamp, entry.timestamp)
    } catch (e) {
      return callback(e)
    }
    callback(null)
  },
  removeLocalEntry: function (path, callback) {
    try {
      var lookup = FS.lookupPath(path)
      var stat = FS.stat(path)
      if (FS.isDir(stat.mode)) {
        FS.rmdir(path)
      } else if (FS.isFile(stat.mode)) {
        FS.unlink(path)
      }
    } catch (e) {
      return callback(e)
    }
    callback(null)
  },
  loadRemoteEntry: function (store, path, callback) {
    var req = store.get(path)
    req.onsuccess = function (event) {
      callback(null, event.target.result)
    }
    req.onerror = function (e) {
      callback(this.error)
      e.preventDefault()
    }
  },
  storeRemoteEntry: function (store, path, entry, callback) {
    var req = store.put(entry, path)
    req.onsuccess = function () {
      callback(null)
    }
    req.onerror = function (e) {
      callback(this.error)
      e.preventDefault()
    }
  },
  removeRemoteEntry: function (store, path, callback) {
    var req = store.delete(path)
    req.onsuccess = function () {
      callback(null)
    }
    req.onerror = function (e) {
      callback(this.error)
      e.preventDefault()
    }
  },
  reconcile: function (src, dst, callback) {
    var total = 0
    var create = []
    Object.keys(src.entries).forEach(function (key) {
      var e = src.entries[key]
      var e2 = dst.entries[key]
      if (!e2 || e.timestamp > e2.timestamp) {
        create.push(key)
        total++
      }
    })
    var remove = []
    Object.keys(dst.entries).forEach(function (key) {
      var e = dst.entries[key]
      var e2 = src.entries[key]
      if (!e2) {
        remove.push(key)
        total++
      }
    })
    if (!total) {
      return callback(null)
    }
    var errored = false
    var db = src.type === 'remote' ? src.db : dst.db
    var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite')
    var store = transaction.objectStore(IDBFS.DB_STORE_NAME)
    function done (err) {
      if (err && !errored) {
        errored = true
        return callback(err)
      }
    }
    transaction.onerror = function (e) {
      done(this.error)
      e.preventDefault()
    }
    transaction.oncomplete = function (e) {
      if (!errored) {
        callback(null)
      }
    }
    create.sort().forEach(function (path) {
      if (dst.type === 'local') {
        IDBFS.loadRemoteEntry(store, path, function (err, entry) {
          if (err) return done(err)
          IDBFS.storeLocalEntry(path, entry, done)
        })
      } else {
        IDBFS.loadLocalEntry(path, function (err, entry) {
          if (err) return done(err)
          IDBFS.storeRemoteEntry(store, path, entry, done)
        })
      }
    })
    remove
      .sort()
      .reverse()
      .forEach(function (path) {
        if (dst.type === 'local') {
          IDBFS.removeLocalEntry(path, done)
        } else {
          IDBFS.removeRemoteEntry(store, path, done)
        }
      })
  }
}
var NODEFS = {
  isWindows: false,
  staticInit: function () {
    NODEFS.isWindows = !!process.platform.match(/^win/)
    var flags = process['binding']('constants')
    if (flags['fs']) {
      flags = flags['fs']
    }
    NODEFS.flagsForNodeMap = {
      1024: flags['O_APPEND'],
      64: flags['O_CREAT'],
      128: flags['O_EXCL'],
      0: flags['O_RDONLY'],
      2: flags['O_RDWR'],
      4096: flags['O_SYNC'],
      512: flags['O_TRUNC'],
      1: flags['O_WRONLY']
    }
  },
  bufferFrom: function (arrayBuffer) {
    return Buffer['alloc'] ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer)
  },
  mount: function (mount) {
    assert(ENVIRONMENT_HAS_NODE)
    return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0)
  },
  createNode: function (parent, name, mode, dev) {
    if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
      throw new FS.ErrnoError(22)
    }
    var node = FS.createNode(parent, name, mode)
    node.node_ops = NODEFS.node_ops
    node.stream_ops = NODEFS.stream_ops
    return node
  },
  getMode: function (path) {
    var stat
    try {
      stat = fs.lstatSync(path)
      if (NODEFS.isWindows) {
        stat.mode = stat.mode | ((stat.mode & 292) >> 2)
      }
    } catch (e) {
      if (!e.code) throw e
      throw new FS.ErrnoError(-e.errno)
    }
    return stat.mode
  },
  realPath: function (node) {
    var parts = []
    while (node.parent !== node) {
      parts.push(node.name)
      node = node.parent
    }
    parts.push(node.mount.opts.root)
    parts.reverse()
    return PATH.join.apply(null, parts)
  },
  flagsForNode: function (flags) {
    flags &= ~2097152
    flags &= ~2048
    flags &= ~32768
    flags &= ~524288
    var newFlags = 0
    for (var k in NODEFS.flagsForNodeMap) {
      if (flags & k) {
        newFlags |= NODEFS.flagsForNodeMap[k]
        flags ^= k
      }
    }
    if (!flags) {
      return newFlags
    } else {
      throw new FS.ErrnoError(22)
    }
  },
  node_ops: {
    getattr: function (node) {
      var path = NODEFS.realPath(node)
      var stat
      try {
        stat = fs.lstatSync(path)
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
      if (NODEFS.isWindows && !stat.blksize) {
        stat.blksize = 4096
      }
      if (NODEFS.isWindows && !stat.blocks) {
        stat.blocks = ((stat.size + stat.blksize - 1) / stat.blksize) | 0
      }
      return {
        dev: stat.dev,
        ino: stat.ino,
        mode: stat.mode,
        nlink: stat.nlink,
        uid: stat.uid,
        gid: stat.gid,
        rdev: stat.rdev,
        size: stat.size,
        atime: stat.atime,
        mtime: stat.mtime,
        ctime: stat.ctime,
        blksize: stat.blksize,
        blocks: stat.blocks
      }
    },
    setattr: function (node, attr) {
      var path = NODEFS.realPath(node)
      try {
        if (attr.mode !== undefined) {
          fs.chmodSync(path, attr.mode)
          node.mode = attr.mode
        }
        if (attr.timestamp !== undefined) {
          var date = new Date(attr.timestamp)
          fs.utimesSync(path, date, date)
        }
        if (attr.size !== undefined) {
          fs.truncateSync(path, attr.size)
        }
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
    },
    lookup: function (parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name)
      var mode = NODEFS.getMode(path)
      return NODEFS.createNode(parent, name, mode)
    },
    mknod: function (parent, name, mode, dev) {
      var node = NODEFS.createNode(parent, name, mode, dev)
      var path = NODEFS.realPath(node)
      try {
        if (FS.isDir(node.mode)) {
          fs.mkdirSync(path, node.mode)
        } else {
          fs.writeFileSync(path, '', { mode: node.mode })
        }
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
      return node
    },
    rename: function (oldNode, newDir, newName) {
      var oldPath = NODEFS.realPath(oldNode)
      var newPath = PATH.join2(NODEFS.realPath(newDir), newName)
      try {
        fs.renameSync(oldPath, newPath)
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
    },
    unlink: function (parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name)
      try {
        fs.unlinkSync(path)
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
    },
    rmdir: function (parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name)
      try {
        fs.rmdirSync(path)
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
    },
    readdir: function (node) {
      var path = NODEFS.realPath(node)
      try {
        return fs.readdirSync(path)
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
    },
    symlink: function (parent, newName, oldPath) {
      var newPath = PATH.join2(NODEFS.realPath(parent), newName)
      try {
        fs.symlinkSync(oldPath, newPath)
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
    },
    readlink: function (node) {
      var path = NODEFS.realPath(node)
      try {
        path = fs.readlinkSync(path)
        path = NODEJS_PATH.relative(
          NODEJS_PATH.resolve(node.mount.opts.root),
          path
        )
        return path
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
    }
  },
  stream_ops: {
    open: function (stream) {
      var path = NODEFS.realPath(stream.node)
      try {
        if (FS.isFile(stream.node.mode)) {
          stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags))
        }
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
    },
    close: function (stream) {
      try {
        if (FS.isFile(stream.node.mode) && stream.nfd) {
          fs.closeSync(stream.nfd)
        }
      } catch (e) {
        if (!e.code) throw e
        throw new FS.ErrnoError(-e.errno)
      }
    },
    read: function (stream, buffer, offset, length, position) {
      if (length === 0) return 0
      try {
        return fs.readSync(
          stream.nfd,
          NODEFS.bufferFrom(buffer.buffer),
          offset,
          length,
          position
        )
      } catch (e) {
        throw new FS.ErrnoError(-e.errno)
      }
    },
    write: function (stream, buffer, offset, length, position) {
      try {
        return fs.writeSync(
          stream.nfd,
          NODEFS.bufferFrom(buffer.buffer),
          offset,
          length,
          position
        )
      } catch (e) {
        throw new FS.ErrnoError(-e.errno)
      }
    },
    llseek: function (stream, offset, whence) {
      var position = offset
      if (whence === 1) {
        position += stream.position
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          try {
            var stat = fs.fstatSync(stream.nfd)
            position += stat.size
          } catch (e) {
            throw new FS.ErrnoError(-e.errno)
          }
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(22)
      }
      return position
    }
  }
}
var WORKERFS = {
  DIR_MODE: 16895,
  FILE_MODE: 33279,
  reader: null,
  mount: function (mount) {
    assert(ENVIRONMENT_IS_WORKER)
    if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync()
    var root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0)
    var createdParents = {}
    function ensureParent (path) {
      var parts = path.split('/')
      var parent = root
      for (var i = 0; i < parts.length - 1; i++) {
        var curr = parts.slice(0, i + 1).join('/')
        if (!createdParents[curr]) {
          createdParents[curr] = WORKERFS.createNode(
            parent,
            parts[i],
            WORKERFS.DIR_MODE,
            0
          )
        }
        parent = createdParents[curr]
      }
      return parent
    }
    function base (path) {
      var parts = path.split('/')
      return parts[parts.length - 1]
    }
    Array.prototype.forEach.call(mount.opts['files'] || [], function (file) {
      WORKERFS.createNode(
        ensureParent(file.name),
        base(file.name),
        WORKERFS.FILE_MODE,
        0,
        file,
        file.lastModifiedDate
      )
    })
    ;(mount.opts['blobs'] || []).forEach(function (obj) {
      WORKERFS.createNode(
        ensureParent(obj['name']),
        base(obj['name']),
        WORKERFS.FILE_MODE,
        0,
        obj['data']
      )
    })
    ;(mount.opts['packages'] || []).forEach(function (pack) {
      pack['metadata'].files.forEach(function (file) {
        var name = file.filename.substr(1)
        WORKERFS.createNode(
          ensureParent(name),
          base(name),
          WORKERFS.FILE_MODE,
          0,
          pack['blob'].slice(file.start, file.end)
        )
      })
    })
    return root
  },
  createNode: function (parent, name, mode, dev, contents, mtime) {
    var node = FS.createNode(parent, name, mode)
    node.mode = mode
    node.node_ops = WORKERFS.node_ops
    node.stream_ops = WORKERFS.stream_ops
    node.timestamp = (mtime || new Date()).getTime()
    assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE)
    if (mode === WORKERFS.FILE_MODE) {
      node.size = contents.size
      node.contents = contents
    } else {
      node.size = 4096
      node.contents = {}
    }
    if (parent) {
      parent.contents[name] = node
    }
    return node
  },
  node_ops: {
    getattr: function (node) {
      return {
        dev: 1,
        ino: undefined,
        mode: node.mode,
        nlink: 1,
        uid: 0,
        gid: 0,
        rdev: undefined,
        size: node.size,
        atime: new Date(node.timestamp),
        mtime: new Date(node.timestamp),
        ctime: new Date(node.timestamp),
        blksize: 4096,
        blocks: Math.ceil(node.size / 4096)
      }
    },
    setattr: function (node, attr) {
      if (attr.mode !== undefined) {
        node.mode = attr.mode
      }
      if (attr.timestamp !== undefined) {
        node.timestamp = attr.timestamp
      }
    },
    lookup: function (parent, name) {
      throw new FS.ErrnoError(2)
    },
    mknod: function (parent, name, mode, dev) {
      throw new FS.ErrnoError(1)
    },
    rename: function (oldNode, newDir, newName) {
      throw new FS.ErrnoError(1)
    },
    unlink: function (parent, name) {
      throw new FS.ErrnoError(1)
    },
    rmdir: function (parent, name) {
      throw new FS.ErrnoError(1)
    },
    readdir: function (node) {
      var entries = ['.', '..']
      for (var key in node.contents) {
        if (!node.contents.hasOwnProperty(key)) {
          continue
        }
        entries.push(key)
      }
      return entries
    },
    symlink: function (parent, newName, oldPath) {
      throw new FS.ErrnoError(1)
    },
    readlink: function (node) {
      throw new FS.ErrnoError(1)
    }
  },
  stream_ops: {
    read: function (stream, buffer, offset, length, position) {
      if (position >= stream.node.size) return 0
      var chunk = stream.node.contents.slice(position, position + length)
      var ab = WORKERFS.reader.readAsArrayBuffer(chunk)
      buffer.set(new Uint8Array(ab), offset)
      return chunk.size
    },
    write: function (stream, buffer, offset, length, position) {
      throw new FS.ErrnoError(5)
    },
    llseek: function (stream, offset, whence) {
      var position = offset
      if (whence === 1) {
        position += stream.position
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.size
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(22)
      }
      return position
    }
  }
}
var FS = {
  root: null,
  mounts: [],
  devices: {},
  streams: [],
  nextInode: 1,
  nameTable: null,
  currentPath: '/',
  initialized: false,
  ignorePermissions: true,
  trackingDelegate: {},
  tracking: { openFlags: { READ: 1, WRITE: 2 } },
  ErrnoError: null,
  genericErrors: {},
  filesystems: null,
  syncFSRequests: 0,
  handleFSError: function (e) {
    if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace()
    return ___setErrNo(e.errno)
  },
  lookupPath: function (path, opts) {
    path = PATH_FS.resolve(FS.cwd(), path)
    opts = opts || {}
    if (!path) return { path: '', node: null }
    var defaults = { follow_mount: true, recurse_count: 0 }
    for (var key in defaults) {
      if (opts[key] === undefined) {
        opts[key] = defaults[key]
      }
    }
    if (opts.recurse_count > 8) {
      throw new FS.ErrnoError(40)
    }
    var parts = PATH.normalizeArray(
      path.split('/').filter(function (p) {
        return !!p
      }),
      false
    )
    var current = FS.root
    var current_path = '/'
    for (var i = 0; i < parts.length; i++) {
      var islast = i === parts.length - 1
      if (islast && opts.parent) {
        break
      }
      current = FS.lookupNode(current, parts[i])
      current_path = PATH.join2(current_path, parts[i])
      if (FS.isMountpoint(current)) {
        if (!islast || (islast && opts.follow_mount)) {
          current = current.mounted.root
        }
      }
      if (!islast || opts.follow) {
        var count = 0
        while (FS.isLink(current.mode)) {
          var link = FS.readlink(current_path)
          current_path = PATH_FS.resolve(PATH.dirname(current_path), link)
          var lookup = FS.lookupPath(current_path, {
            recurse_count: opts.recurse_count
          })
          current = lookup.node
          if (count++ > 40) {
            throw new FS.ErrnoError(40)
          }
        }
      }
    }
    return { path: current_path, node: current }
  },
  getPath: function (node) {
    var path
    while (true) {
      if (FS.isRoot(node)) {
        var mount = node.mount.mountpoint
        if (!path) return mount
        return mount[mount.length - 1] !== '/'
          ? mount + '/' + path
          : mount + path
      }
      path = path ? node.name + '/' + path : node.name
      node = node.parent
    }
  },
  hashName: function (parentid, name) {
    var hash = 0
    for (var i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
    }
    return ((parentid + hash) >>> 0) % FS.nameTable.length
  },
  hashAddNode: function (node) {
    var hash = FS.hashName(node.parent.id, node.name)
    node.name_next = FS.nameTable[hash]
    FS.nameTable[hash] = node
  },
  hashRemoveNode: function (node) {
    var hash = FS.hashName(node.parent.id, node.name)
    if (FS.nameTable[hash] === node) {
      FS.nameTable[hash] = node.name_next
    } else {
      var current = FS.nameTable[hash]
      while (current) {
        if (current.name_next === node) {
          current.name_next = node.name_next
          break
        }
        current = current.name_next
      }
    }
  },
  lookupNode: function (parent, name) {
    var err = FS.mayLookup(parent)
    if (err) {
      throw new FS.ErrnoError(err, parent)
    }
    var hash = FS.hashName(parent.id, name)
    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
      var nodeName = node.name
      if (node.parent.id === parent.id && nodeName === name) {
        return node
      }
    }
    return FS.lookup(parent, name)
  },
  createNode: function (parent, name, mode, rdev) {
    if (!FS.FSNode) {
      FS.FSNode = function (parent, name, mode, rdev) {
        if (!parent) {
          parent = this
        }
        this.parent = parent
        this.mount = parent.mount
        this.mounted = null
        this.id = FS.nextInode++
        this.name = name
        this.mode = mode
        this.node_ops = {}
        this.stream_ops = {}
        this.rdev = rdev
      }
      FS.FSNode.prototype = {}
      var readMode = 292 | 73
      var writeMode = 146
      Object.defineProperties(FS.FSNode.prototype, {
        read: {
          get: function () {
            return (this.mode & readMode) === readMode
          },
          set: function (val) {
            val ? (this.mode |= readMode) : (this.mode &= ~readMode)
          }
        },
        write: {
          get: function () {
            return (this.mode & writeMode) === writeMode
          },
          set: function (val) {
            val ? (this.mode |= writeMode) : (this.mode &= ~writeMode)
          }
        },
        isFolder: {
          get: function () {
            return FS.isDir(this.mode)
          }
        },
        isDevice: {
          get: function () {
            return FS.isChrdev(this.mode)
          }
        }
      })
    }
    var node = new FS.FSNode(parent, name, mode, rdev)
    FS.hashAddNode(node)
    return node
  },
  destroyNode: function (node) {
    FS.hashRemoveNode(node)
  },
  isRoot: function (node) {
    return node === node.parent
  },
  isMountpoint: function (node) {
    return !!node.mounted
  },
  isFile: function (mode) {
    return (mode & 61440) === 32768
  },
  isDir: function (mode) {
    return (mode & 61440) === 16384
  },
  isLink: function (mode) {
    return (mode & 61440) === 40960
  },
  isChrdev: function (mode) {
    return (mode & 61440) === 8192
  },
  isBlkdev: function (mode) {
    return (mode & 61440) === 24576
  },
  isFIFO: function (mode) {
    return (mode & 61440) === 4096
  },
  isSocket: function (mode) {
    return (mode & 49152) === 49152
  },
  flagModes: {
    r: 0,
    rs: 1052672,
    'r+': 2,
    w: 577,
    wx: 705,
    xw: 705,
    'w+': 578,
    'wx+': 706,
    'xw+': 706,
    a: 1089,
    ax: 1217,
    xa: 1217,
    'a+': 1090,
    'ax+': 1218,
    'xa+': 1218
  },
  modeStringToFlags: function (str) {
    var flags = FS.flagModes[str]
    if (typeof flags === 'undefined') {
      throw new Error('Unknown file open mode: ' + str)
    }
    return flags
  },
  flagsToPermissionString: function (flag) {
    var perms = ['r', 'w', 'rw'][flag & 3]
    if (flag & 512) {
      perms += 'w'
    }
    return perms
  },
  nodePermissions: function (node, perms) {
    if (FS.ignorePermissions) {
      return 0
    }
    if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
      return 13
    } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
      return 13
    } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
      return 13
    }
    return 0
  },
  mayLookup: function (dir) {
    var err = FS.nodePermissions(dir, 'x')
    if (err) return err
    if (!dir.node_ops.lookup) return 13
    return 0
  },
  mayCreate: function (dir, name) {
    try {
      var node = FS.lookupNode(dir, name)
      return 17
    } catch (e) {}
    return FS.nodePermissions(dir, 'wx')
  },
  mayDelete: function (dir, name, isdir) {
    var node
    try {
      node = FS.lookupNode(dir, name)
    } catch (e) {
      return e.errno
    }
    var err = FS.nodePermissions(dir, 'wx')
    if (err) {
      return err
    }
    if (isdir) {
      if (!FS.isDir(node.mode)) {
        return 20
      }
      if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
        return 16
      }
    } else {
      if (FS.isDir(node.mode)) {
        return 21
      }
    }
    return 0
  },
  mayOpen: function (node, flags) {
    if (!node) {
      return 2
    }
    if (FS.isLink(node.mode)) {
      return 40
    } else if (FS.isDir(node.mode)) {
      if (FS.flagsToPermissionString(flags) !== 'r' || flags & 512) {
        return 21
      }
    }
    return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
  },
  MAX_OPEN_FDS: 4096,
  nextfd: function (fd_start, fd_end) {
    fd_start = fd_start || 0
    fd_end = fd_end || FS.MAX_OPEN_FDS
    for (var fd = fd_start; fd <= fd_end; fd++) {
      if (!FS.streams[fd]) {
        return fd
      }
    }
    throw new FS.ErrnoError(24)
  },
  getStream: function (fd) {
    return FS.streams[fd]
  },
  createStream: function (stream, fd_start, fd_end) {
    if (!FS.FSStream) {
      FS.FSStream = function () {}
      FS.FSStream.prototype = {}
      Object.defineProperties(FS.FSStream.prototype, {
        object: {
          get: function () {
            return this.node
          },
          set: function (val) {
            this.node = val
          }
        },
        isRead: {
          get: function () {
            return (this.flags & 2097155) !== 1
          }
        },
        isWrite: {
          get: function () {
            return (this.flags & 2097155) !== 0
          }
        },
        isAppend: {
          get: function () {
            return this.flags & 1024
          }
        }
      })
    }
    var newStream = new FS.FSStream()
    for (var p in stream) {
      newStream[p] = stream[p]
    }
    stream = newStream
    var fd = FS.nextfd(fd_start, fd_end)
    stream.fd = fd
    FS.streams[fd] = stream
    return stream
  },
  closeStream: function (fd) {
    FS.streams[fd] = null
  },
  chrdev_stream_ops: {
    open: function (stream) {
      var device = FS.getDevice(stream.node.rdev)
      stream.stream_ops = device.stream_ops
      if (stream.stream_ops.open) {
        stream.stream_ops.open(stream)
      }
    },
    llseek: function () {
      throw new FS.ErrnoError(29)
    }
  },
  major: function (dev) {
    return dev >> 8
  },
  minor: function (dev) {
    return dev & 255
  },
  makedev: function (ma, mi) {
    return (ma << 8) | mi
  },
  registerDevice: function (dev, ops) {
    FS.devices[dev] = { stream_ops: ops }
  },
  getDevice: function (dev) {
    return FS.devices[dev]
  },
  getMounts: function (mount) {
    var mounts = []
    var check = [mount]
    while (check.length) {
      var m = check.pop()
      mounts.push(m)
      check.push.apply(check, m.mounts)
    }
    return mounts
  },
  syncfs: function (populate, callback) {
    if (typeof populate === 'function') {
      callback = populate
      populate = false
    }
    FS.syncFSRequests++
    if (FS.syncFSRequests > 1) {
      console.log(
        'warning: ' +
          FS.syncFSRequests +
          ' FS.syncfs operations in flight at once, probably just doing extra work'
      )
    }
    var mounts = FS.getMounts(FS.root.mount)
    var completed = 0
    function doCallback (err) {
      FS.syncFSRequests--
      return callback(err)
    }
    function done (err) {
      if (err) {
        if (!done.errored) {
          done.errored = true
          return doCallback(err)
        }
        return
      }
      if (++completed >= mounts.length) {
        doCallback(null)
      }
    }
    mounts.forEach(function (mount) {
      if (!mount.type.syncfs) {
        return done(null)
      }
      mount.type.syncfs(mount, populate, done)
    })
  },
  mount: function (type, opts, mountpoint) {
    var root = mountpoint === '/'
    var pseudo = !mountpoint
    var node
    if (root && FS.root) {
      throw new FS.ErrnoError(16)
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, { follow_mount: false })
      mountpoint = lookup.path
      node = lookup.node
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(16)
      }
      if (!FS.isDir(node.mode)) {
        throw new FS.ErrnoError(20)
      }
    }
    var mount = { type: type, opts: opts, mountpoint: mountpoint, mounts: [] }
    var mountRoot = type.mount(mount)
    mountRoot.mount = mount
    mount.root = mountRoot
    if (root) {
      FS.root = mountRoot
    } else if (node) {
      node.mounted = mount
      if (node.mount) {
        node.mount.mounts.push(mount)
      }
    }
    return mountRoot
  },
  unmount: function (mountpoint) {
    var lookup = FS.lookupPath(mountpoint, { follow_mount: false })
    if (!FS.isMountpoint(lookup.node)) {
      throw new FS.ErrnoError(22)
    }
    var node = lookup.node
    var mount = node.mounted
    var mounts = FS.getMounts(mount)
    Object.keys(FS.nameTable).forEach(function (hash) {
      var current = FS.nameTable[hash]
      while (current) {
        var next = current.name_next
        if (mounts.indexOf(current.mount) !== -1) {
          FS.destroyNode(current)
        }
        current = next
      }
    })
    node.mounted = null
    var idx = node.mount.mounts.indexOf(mount)
    node.mount.mounts.splice(idx, 1)
  },
  lookup: function (parent, name) {
    return parent.node_ops.lookup(parent, name)
  },
  mknod: function (path, mode, dev) {
    var lookup = FS.lookupPath(path, { parent: true })
    var parent = lookup.node
    var name = PATH.basename(path)
    if (!name || name === '.' || name === '..') {
      throw new FS.ErrnoError(22)
    }
    var err = FS.mayCreate(parent, name)
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.mknod) {
      throw new FS.ErrnoError(1)
    }
    return parent.node_ops.mknod(parent, name, mode, dev)
  },
  create: function (path, mode) {
    mode = mode !== undefined ? mode : 438
    mode &= 4095
    mode |= 32768
    return FS.mknod(path, mode, 0)
  },
  mkdir: function (path, mode) {
    mode = mode !== undefined ? mode : 511
    mode &= 511 | 512
    mode |= 16384
    return FS.mknod(path, mode, 0)
  },
  mkdirTree: function (path, mode) {
    var dirs = path.split('/')
    var d = ''
    for (var i = 0; i < dirs.length; ++i) {
      if (!dirs[i]) continue
      d += '/' + dirs[i]
      try {
        FS.mkdir(d, mode)
      } catch (e) {
        if (e.errno != 17) throw e
      }
    }
  },
  mkdev: function (path, mode, dev) {
    if (typeof dev === 'undefined') {
      dev = mode
      mode = 438
    }
    mode |= 8192
    return FS.mknod(path, mode, dev)
  },
  symlink: function (oldpath, newpath) {
    if (!PATH_FS.resolve(oldpath)) {
      throw new FS.ErrnoError(2)
    }
    var lookup = FS.lookupPath(newpath, { parent: true })
    var parent = lookup.node
    if (!parent) {
      throw new FS.ErrnoError(2)
    }
    var newname = PATH.basename(newpath)
    var err = FS.mayCreate(parent, newname)
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.symlink) {
      throw new FS.ErrnoError(1)
    }
    return parent.node_ops.symlink(parent, newname, oldpath)
  },
  rename: function (old_path, new_path) {
    var old_dirname = PATH.dirname(old_path)
    var new_dirname = PATH.dirname(new_path)
    var old_name = PATH.basename(old_path)
    var new_name = PATH.basename(new_path)
    var lookup, old_dir, new_dir
    try {
      lookup = FS.lookupPath(old_path, { parent: true })
      old_dir = lookup.node
      lookup = FS.lookupPath(new_path, { parent: true })
      new_dir = lookup.node
    } catch (e) {
      throw new FS.ErrnoError(16)
    }
    if (!old_dir || !new_dir) throw new FS.ErrnoError(2)
    if (old_dir.mount !== new_dir.mount) {
      throw new FS.ErrnoError(18)
    }
    var old_node = FS.lookupNode(old_dir, old_name)
    var relative = PATH_FS.relative(old_path, new_dirname)
    if (relative.charAt(0) !== '.') {
      throw new FS.ErrnoError(22)
    }
    relative = PATH_FS.relative(new_path, old_dirname)
    if (relative.charAt(0) !== '.') {
      throw new FS.ErrnoError(39)
    }
    var new_node
    try {
      new_node = FS.lookupNode(new_dir, new_name)
    } catch (e) {}
    if (old_node === new_node) {
      return
    }
    var isdir = FS.isDir(old_node.mode)
    var err = FS.mayDelete(old_dir, old_name, isdir)
    if (err) {
      throw new FS.ErrnoError(err)
    }
    err = new_node
      ? FS.mayDelete(new_dir, new_name, isdir)
      : FS.mayCreate(new_dir, new_name)
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(1)
    }
    if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
      throw new FS.ErrnoError(16)
    }
    if (new_dir !== old_dir) {
      err = FS.nodePermissions(old_dir, 'w')
      if (err) {
        throw new FS.ErrnoError(err)
      }
    }
    try {
      if (FS.trackingDelegate['willMovePath']) {
        FS.trackingDelegate['willMovePath'](old_path, new_path)
      }
    } catch (e) {
      console.log(
        "FS.trackingDelegate['willMovePath']('" +
          old_path +
          "', '" +
          new_path +
          "') threw an exception: " +
          e.message
      )
    }
    FS.hashRemoveNode(old_node)
    try {
      old_dir.node_ops.rename(old_node, new_dir, new_name)
    } catch (e) {
      throw e
    } finally {
      FS.hashAddNode(old_node)
    }
    try {
      if (FS.trackingDelegate['onMovePath'])
        FS.trackingDelegate['onMovePath'](old_path, new_path)
    } catch (e) {
      console.log(
        "FS.trackingDelegate['onMovePath']('" +
          old_path +
          "', '" +
          new_path +
          "') threw an exception: " +
          e.message
      )
    }
  },
  rmdir: function (path) {
    var lookup = FS.lookupPath(path, { parent: true })
    var parent = lookup.node
    var name = PATH.basename(path)
    var node = FS.lookupNode(parent, name)
    var err = FS.mayDelete(parent, name, true)
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.rmdir) {
      throw new FS.ErrnoError(1)
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(16)
    }
    try {
      if (FS.trackingDelegate['willDeletePath']) {
        FS.trackingDelegate['willDeletePath'](path)
      }
    } catch (e) {
      console.log(
        "FS.trackingDelegate['willDeletePath']('" +
          path +
          "') threw an exception: " +
          e.message
      )
    }
    parent.node_ops.rmdir(parent, name)
    FS.destroyNode(node)
    try {
      if (FS.trackingDelegate['onDeletePath'])
        FS.trackingDelegate['onDeletePath'](path)
    } catch (e) {
      console.log(
        "FS.trackingDelegate['onDeletePath']('" +
          path +
          "') threw an exception: " +
          e.message
      )
    }
  },
  readdir: function (path) {
    var lookup = FS.lookupPath(path, { follow: true })
    var node = lookup.node
    if (!node.node_ops.readdir) {
      throw new FS.ErrnoError(20)
    }
    return node.node_ops.readdir(node)
  },
  unlink: function (path) {
    var lookup = FS.lookupPath(path, { parent: true })
    var parent = lookup.node
    var name = PATH.basename(path)
    var node = FS.lookupNode(parent, name)
    var err = FS.mayDelete(parent, name, false)
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.unlink) {
      throw new FS.ErrnoError(1)
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(16)
    }
    try {
      if (FS.trackingDelegate['willDeletePath']) {
        FS.trackingDelegate['willDeletePath'](path)
      }
    } catch (e) {
      console.log(
        "FS.trackingDelegate['willDeletePath']('" +
          path +
          "') threw an exception: " +
          e.message
      )
    }
    parent.node_ops.unlink(parent, name)
    FS.destroyNode(node)
    try {
      if (FS.trackingDelegate['onDeletePath'])
        FS.trackingDelegate['onDeletePath'](path)
    } catch (e) {
      console.log(
        "FS.trackingDelegate['onDeletePath']('" +
          path +
          "') threw an exception: " +
          e.message
      )
    }
  },
  readlink: function (path) {
    var lookup = FS.lookupPath(path)
    var link = lookup.node
    if (!link) {
      throw new FS.ErrnoError(2)
    }
    if (!link.node_ops.readlink) {
      throw new FS.ErrnoError(22)
    }
    return PATH_FS.resolve(
      FS.getPath(link.parent),
      link.node_ops.readlink(link)
    )
  },
  stat: function (path, dontFollow) {
    var lookup = FS.lookupPath(path, { follow: !dontFollow })
    var node = lookup.node
    if (!node) {
      throw new FS.ErrnoError(2)
    }
    if (!node.node_ops.getattr) {
      throw new FS.ErrnoError(1)
    }
    return node.node_ops.getattr(node)
  },
  lstat: function (path) {
    return FS.stat(path, true)
  },
  chmod: function (path, mode, dontFollow) {
    var node
    if (typeof path === 'string') {
      var lookup = FS.lookupPath(path, { follow: !dontFollow })
      node = lookup.node
    } else {
      node = path
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(1)
    }
    node.node_ops.setattr(node, {
      mode: (mode & 4095) | (node.mode & ~4095),
      timestamp: Date.now()
    })
  },
  lchmod: function (path, mode) {
    FS.chmod(path, mode, true)
  },
  fchmod: function (fd, mode) {
    var stream = FS.getStream(fd)
    if (!stream) {
      throw new FS.ErrnoError(9)
    }
    FS.chmod(stream.node, mode)
  },
  chown: function (path, uid, gid, dontFollow) {
    var node
    if (typeof path === 'string') {
      var lookup = FS.lookupPath(path, { follow: !dontFollow })
      node = lookup.node
    } else {
      node = path
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(1)
    }
    node.node_ops.setattr(node, { timestamp: Date.now() })
  },
  lchown: function (path, uid, gid) {
    FS.chown(path, uid, gid, true)
  },
  fchown: function (fd, uid, gid) {
    var stream = FS.getStream(fd)
    if (!stream) {
      throw new FS.ErrnoError(9)
    }
    FS.chown(stream.node, uid, gid)
  },
  truncate: function (path, len) {
    if (len < 0) {
      throw new FS.ErrnoError(22)
    }
    var node
    if (typeof path === 'string') {
      var lookup = FS.lookupPath(path, { follow: true })
      node = lookup.node
    } else {
      node = path
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(1)
    }
    if (FS.isDir(node.mode)) {
      throw new FS.ErrnoError(21)
    }
    if (!FS.isFile(node.mode)) {
      throw new FS.ErrnoError(22)
    }
    var err = FS.nodePermissions(node, 'w')
    if (err) {
      throw new FS.ErrnoError(err)
    }
    node.node_ops.setattr(node, { size: len, timestamp: Date.now() })
  },
  ftruncate: function (fd, len) {
    var stream = FS.getStream(fd)
    if (!stream) {
      throw new FS.ErrnoError(9)
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(22)
    }
    FS.truncate(stream.node, len)
  },
  utime: function (path, atime, mtime) {
    var lookup = FS.lookupPath(path, { follow: true })
    var node = lookup.node
    node.node_ops.setattr(node, { timestamp: Math.max(atime, mtime) })
  },
  open: function (path, flags, mode, fd_start, fd_end) {
    if (path === '') {
      throw new FS.ErrnoError(2)
    }
    flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags
    mode = typeof mode === 'undefined' ? 438 : mode
    if (flags & 64) {
      mode = (mode & 4095) | 32768
    } else {
      mode = 0
    }
    var node
    if (typeof path === 'object') {
      node = path
    } else {
      path = PATH.normalize(path)
      try {
        var lookup = FS.lookupPath(path, { follow: !(flags & 131072) })
        node = lookup.node
      } catch (e) {}
    }
    var created = false
    if (flags & 64) {
      if (node) {
        if (flags & 128) {
          throw new FS.ErrnoError(17)
        }
      } else {
        node = FS.mknod(path, mode, 0)
        created = true
      }
    }
    if (!node) {
      throw new FS.ErrnoError(2)
    }
    if (FS.isChrdev(node.mode)) {
      flags &= ~512
    }
    if (flags & 65536 && !FS.isDir(node.mode)) {
      throw new FS.ErrnoError(20)
    }
    if (!created) {
      var err = FS.mayOpen(node, flags)
      if (err) {
        throw new FS.ErrnoError(err)
      }
    }
    if (flags & 512) {
      FS.truncate(node, 0)
    }
    flags &= ~(128 | 512)
    var stream = FS.createStream(
      {
        node: node,
        path: FS.getPath(node),
        flags: flags,
        seekable: true,
        position: 0,
        stream_ops: node.stream_ops,
        ungotten: [],
        error: false
      },
      fd_start,
      fd_end
    )
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream)
    }
    if (Module['logReadFiles'] && !(flags & 1)) {
      if (!FS.readFiles) FS.readFiles = {}
      if (!(path in FS.readFiles)) {
        FS.readFiles[path] = 1
        console.log('FS.trackingDelegate error on read file: ' + path)
      }
    }
    try {
      if (FS.trackingDelegate['onOpenFile']) {
        var trackingFlags = 0
        if ((flags & 2097155) !== 1) {
          trackingFlags |= FS.tracking.openFlags.READ
        }
        if ((flags & 2097155) !== 0) {
          trackingFlags |= FS.tracking.openFlags.WRITE
        }
        FS.trackingDelegate['onOpenFile'](path, trackingFlags)
      }
    } catch (e) {
      console.log(
        "FS.trackingDelegate['onOpenFile']('" +
          path +
          "', flags) threw an exception: " +
          e.message
      )
    }
    return stream
  },
  close: function (stream) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(9)
    }
    if (stream.getdents) stream.getdents = null
    try {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream)
      }
    } catch (e) {
      throw e
    } finally {
      FS.closeStream(stream.fd)
    }
    stream.fd = null
  },
  isClosed: function (stream) {
    return stream.fd === null
  },
  llseek: function (stream, offset, whence) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(9)
    }
    if (!stream.seekable || !stream.stream_ops.llseek) {
      throw new FS.ErrnoError(29)
    }
    if (whence != 0 && whence != 1 && whence != 2) {
      throw new FS.ErrnoError(22)
    }
    stream.position = stream.stream_ops.llseek(stream, offset, whence)
    stream.ungotten = []
    return stream.position
  },
  read: function (stream, buffer, offset, length, position) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(22)
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(9)
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(9)
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(21)
    }
    if (!stream.stream_ops.read) {
      throw new FS.ErrnoError(22)
    }
    var seeking = typeof position !== 'undefined'
    if (!seeking) {
      position = stream.position
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(29)
    }
    var bytesRead = stream.stream_ops.read(
      stream,
      buffer,
      offset,
      length,
      position
    )
    if (!seeking) stream.position += bytesRead
    return bytesRead
  },
  write: function (stream, buffer, offset, length, position, canOwn) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(22)
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(9)
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(9)
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(21)
    }
    if (!stream.stream_ops.write) {
      throw new FS.ErrnoError(22)
    }
    if (stream.flags & 1024) {
      FS.llseek(stream, 0, 2)
    }
    var seeking = typeof position !== 'undefined'
    if (!seeking) {
      position = stream.position
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(29)
    }
    var bytesWritten = stream.stream_ops.write(
      stream,
      buffer,
      offset,
      length,
      position,
      canOwn
    )
    if (!seeking) stream.position += bytesWritten
    try {
      if (stream.path && FS.trackingDelegate['onWriteToFile'])
        FS.trackingDelegate['onWriteToFile'](stream.path)
    } catch (e) {
      console.log(
        "FS.trackingDelegate['onWriteToFile']('" +
          stream.path +
          "') threw an exception: " +
          e.message
      )
    }
    return bytesWritten
  },
  allocate: function (stream, offset, length) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(9)
    }
    if (offset < 0 || length <= 0) {
      throw new FS.ErrnoError(22)
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(9)
    }
    if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(19)
    }
    if (!stream.stream_ops.allocate) {
      throw new FS.ErrnoError(95)
    }
    stream.stream_ops.allocate(stream, offset, length)
  },
  mmap: function (stream, buffer, offset, length, position, prot, flags) {
    if (
      (prot & 2) !== 0 &&
      (flags & 2) === 0 &&
      (stream.flags & 2097155) !== 2
    ) {
      throw new FS.ErrnoError(13)
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(13)
    }
    if (!stream.stream_ops.mmap) {
      throw new FS.ErrnoError(19)
    }
    return stream.stream_ops.mmap(
      stream,
      buffer,
      offset,
      length,
      position,
      prot,
      flags
    )
  },
  msync: function (stream, buffer, offset, length, mmapFlags) {
    if (!stream || !stream.stream_ops.msync) {
      return 0
    }
    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
  },
  munmap: function (stream) {
    return 0
  },
  ioctl: function (stream, cmd, arg) {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(25)
    }
    return stream.stream_ops.ioctl(stream, cmd, arg)
  },
  readFile: function (path, opts) {
    opts = opts || {}
    opts.flags = opts.flags || 'r'
    opts.encoding = opts.encoding || 'binary'
    if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
      throw new Error('Invalid encoding type "' + opts.encoding + '"')
    }
    var ret
    var stream = FS.open(path, opts.flags)
    var stat = FS.stat(path)
    var length = stat.size
    var buf = new Uint8Array(length)
    FS.read(stream, buf, 0, length, 0)
    if (opts.encoding === 'utf8') {
      ret = UTF8ArrayToString(buf, 0)
    } else if (opts.encoding === 'binary') {
      ret = buf
    }
    FS.close(stream)
    return ret
  },
  writeFile: function (path, data, opts) {
    opts = opts || {}
    opts.flags = opts.flags || 'w'
    var stream = FS.open(path, opts.flags, opts.mode)
    if (typeof data === 'string') {
      var buf = new Uint8Array(lengthBytesUTF8(data) + 1)
      var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length)
      FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
    } else if (ArrayBuffer.isView(data)) {
      FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
    } else {
      throw new Error('Unsupported data type')
    }
    FS.close(stream)
  },
  cwd: function () {
    return FS.currentPath
  },
  chdir: function (path) {
    var lookup = FS.lookupPath(path, { follow: true })
    if (lookup.node === null) {
      throw new FS.ErrnoError(2)
    }
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(20)
    }
    var err = FS.nodePermissions(lookup.node, 'x')
    if (err) {
      throw new FS.ErrnoError(err)
    }
    FS.currentPath = lookup.path
  },
  createDefaultDirectories: function () {
    FS.mkdir('/tmp')
    FS.mkdir('/home')
    FS.mkdir('/home/web_user')
  },
  createDefaultDevices: function () {
    FS.mkdir('/dev')
    FS.registerDevice(FS.makedev(1, 3), {
      read: function () {
        return 0
      },
      write: function (stream, buffer, offset, length, pos) {
        return length
      }
    })
    FS.mkdev('/dev/null', FS.makedev(1, 3))
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops)
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops)
    FS.mkdev('/dev/tty', FS.makedev(5, 0))
    FS.mkdev('/dev/tty1', FS.makedev(6, 0))
    var random_device
    if (
      typeof crypto === 'object' &&
      typeof crypto['getRandomValues'] === 'function'
    ) {
      var randomBuffer = new Uint8Array(1)
      random_device = function () {
        crypto.getRandomValues(randomBuffer)
        return randomBuffer[0]
      }
    } else if (ENVIRONMENT_IS_NODE) {
      try {
        var crypto_module = require('crypto')
        random_device = function () {
          return crypto_module['randomBytes'](1)[0]
        }
      } catch (e) {}
    } else {
    }
    if (!random_device) {
      random_device = function () {
        abort('random_device')
      }
    }
    FS.createDevice('/dev', 'random', random_device)
    FS.createDevice('/dev', 'urandom', random_device)
    FS.mkdir('/dev/shm')
    FS.mkdir('/dev/shm/tmp')
  },
  createSpecialDirectories: function () {
    FS.mkdir('/proc')
    FS.mkdir('/proc/self')
    FS.mkdir('/proc/self/fd')
    FS.mount(
      {
        mount: function () {
          var node = FS.createNode('/proc/self', 'fd', 16384 | 511, 73)
          node.node_ops = {
            lookup: function (parent, name) {
              var fd = +name
              var stream = FS.getStream(fd)
              if (!stream) throw new FS.ErrnoError(9)
              var ret = {
                parent: null,
                mount: { mountpoint: 'fake' },
                node_ops: {
                  readlink: function () {
                    return stream.path
                  }
                }
              }
              ret.parent = ret
              return ret
            }
          }
          return node
        }
      },
      {},
      '/proc/self/fd'
    )
  },
  createStandardStreams: function () {
    if (Module['stdin']) {
      FS.createDevice('/dev', 'stdin', Module['stdin'])
    } else {
      FS.symlink('/dev/tty', '/dev/stdin')
    }
    if (Module['stdout']) {
      FS.createDevice('/dev', 'stdout', null, Module['stdout'])
    } else {
      FS.symlink('/dev/tty', '/dev/stdout')
    }
    if (Module['stderr']) {
      FS.createDevice('/dev', 'stderr', null, Module['stderr'])
    } else {
      FS.symlink('/dev/tty1', '/dev/stderr')
    }
    var stdin = FS.open('/dev/stdin', 'r')
    var stdout = FS.open('/dev/stdout', 'w')
    var stderr = FS.open('/dev/stderr', 'w')
  },
  ensureErrnoError: function () {
    if (FS.ErrnoError) return
    FS.ErrnoError = function ErrnoError (errno, node) {
      this.node = node
      this.setErrno = function (errno) {
        this.errno = errno
      }
      this.setErrno(errno)
      this.message = 'FS error'
    }
    FS.ErrnoError.prototype = new Error()
    FS.ErrnoError.prototype.constructor = FS.ErrnoError
    ;[2].forEach(function (code) {
      FS.genericErrors[code] = new FS.ErrnoError(code)
      FS.genericErrors[code].stack = '<generic error, no stack>'
    })
  },
  staticInit: function () {
    FS.ensureErrnoError()
    FS.nameTable = new Array(4096)
    FS.mount(MEMFS, {}, '/')
    FS.createDefaultDirectories()
    FS.createDefaultDevices()
    FS.createSpecialDirectories()
    FS.filesystems = {
      MEMFS: MEMFS,
      IDBFS: IDBFS,
      NODEFS: NODEFS,
      WORKERFS: WORKERFS
    }
  },
  init: function (input, output, error) {
    FS.init.initialized = true
    FS.ensureErrnoError()
    Module['stdin'] = input || Module['stdin']
    Module['stdout'] = output || Module['stdout']
    Module['stderr'] = error || Module['stderr']
    FS.createStandardStreams()
  },
  quit: function () {
    FS.init.initialized = false
    var fflush = Module['_fflush']
    if (fflush) fflush(0)
    for (var i = 0; i < FS.streams.length; i++) {
      var stream = FS.streams[i]
      if (!stream) {
        continue
      }
      FS.close(stream)
    }
  },
  getMode: function (canRead, canWrite) {
    var mode = 0
    if (canRead) mode |= 292 | 73
    if (canWrite) mode |= 146
    return mode
  },
  joinPath: function (parts, forceRelative) {
    var path = PATH.join.apply(null, parts)
    if (forceRelative && path[0] == '/') path = path.substr(1)
    return path
  },
  absolutePath: function (relative, base) {
    return PATH_FS.resolve(base, relative)
  },
  standardizePath: function (path) {
    return PATH.normalize(path)
  },
  findObject: function (path, dontResolveLastLink) {
    var ret = FS.analyzePath(path, dontResolveLastLink)
    if (ret.exists) {
      return ret.object
    } else {
      ___setErrNo(ret.error)
      return null
    }
  },
  analyzePath: function (path, dontResolveLastLink) {
    try {
      var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink })
      path = lookup.path
    } catch (e) {}
    var ret = {
      isRoot: false,
      exists: false,
      error: 0,
      name: null,
      path: null,
      object: null,
      parentExists: false,
      parentPath: null,
      parentObject: null
    }
    try {
      var lookup = FS.lookupPath(path, { parent: true })
      ret.parentExists = true
      ret.parentPath = lookup.path
      ret.parentObject = lookup.node
      ret.name = PATH.basename(path)
      lookup = FS.lookupPath(path, { follow: !dontResolveLastLink })
      ret.exists = true
      ret.path = lookup.path
      ret.object = lookup.node
      ret.name = lookup.node.name
      ret.isRoot = lookup.path === '/'
    } catch (e) {
      ret.error = e.errno
    }
    return ret
  },
  createFolder: function (parent, name, canRead, canWrite) {
    var path = PATH.join2(
      typeof parent === 'string' ? parent : FS.getPath(parent),
      name
    )
    var mode = FS.getMode(canRead, canWrite)
    return FS.mkdir(path, mode)
  },
  createPath: function (parent, path, canRead, canWrite) {
    parent = typeof parent === 'string' ? parent : FS.getPath(parent)
    var parts = path.split('/').reverse()
    while (parts.length) {
      var part = parts.pop()
      if (!part) continue
      var current = PATH.join2(parent, part)
      try {
        FS.mkdir(current)
      } catch (e) {}
      parent = current
    }
    return current
  },
  createFile: function (parent, name, properties, canRead, canWrite) {
    var path = PATH.join2(
      typeof parent === 'string' ? parent : FS.getPath(parent),
      name
    )
    var mode = FS.getMode(canRead, canWrite)
    return FS.create(path, mode)
  },
  createDataFile: function (parent, name, data, canRead, canWrite, canOwn) {
    var path = name
      ? PATH.join2(
          typeof parent === 'string' ? parent : FS.getPath(parent),
          name
        )
      : parent
    var mode = FS.getMode(canRead, canWrite)
    var node = FS.create(path, mode)
    if (data) {
      if (typeof data === 'string') {
        var arr = new Array(data.length)
        for (var i = 0, len = data.length; i < len; ++i)
          arr[i] = data.charCodeAt(i)
        data = arr
      }
      FS.chmod(node, mode | 146)
      var stream = FS.open(node, 'w')
      FS.write(stream, data, 0, data.length, 0, canOwn)
      FS.close(stream)
      FS.chmod(node, mode)
    }
    return node
  },
  createDevice: function (parent, name, input, output) {
    var path = PATH.join2(
      typeof parent === 'string' ? parent : FS.getPath(parent),
      name
    )
    var mode = FS.getMode(!!input, !!output)
    if (!FS.createDevice.major) FS.createDevice.major = 64
    var dev = FS.makedev(FS.createDevice.major++, 0)
    FS.registerDevice(dev, {
      open: function (stream) {
        stream.seekable = false
      },
      close: function (stream) {
        if (output && output.buffer && output.buffer.length) {
          output(10)
        }
      },
      read: function (stream, buffer, offset, length, pos) {
        var bytesRead = 0
        for (var i = 0; i < length; i++) {
          var result
          try {
            result = input()
          } catch (e) {
            throw new FS.ErrnoError(5)
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(11)
          }
          if (result === null || result === undefined) break
          bytesRead++
          buffer[offset + i] = result
        }
        if (bytesRead) {
          stream.node.timestamp = Date.now()
        }
        return bytesRead
      },
      write: function (stream, buffer, offset, length, pos) {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i])
          } catch (e) {
            throw new FS.ErrnoError(5)
          }
        }
        if (length) {
          stream.node.timestamp = Date.now()
        }
        return i
      }
    })
    return FS.mkdev(path, mode, dev)
  },
  createLink: function (parent, name, target, canRead, canWrite) {
    var path = PATH.join2(
      typeof parent === 'string' ? parent : FS.getPath(parent),
      name
    )
    return FS.symlink(target, path)
  },
  forceLoadFile: function (obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true
    var success = true
    if (typeof XMLHttpRequest !== 'undefined') {
      throw new Error(
        'Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.'
      )
    } else if (read_) {
      try {
        obj.contents = intArrayFromString(read_(obj.url), true)
        obj.usedBytes = obj.contents.length
      } catch (e) {
        success = false
      }
    } else {
      throw new Error('Cannot load without read() or XMLHttpRequest.')
    }
    if (!success) ___setErrNo(5)
    return success
  },
  createLazyFile: function (parent, name, url, canRead, canWrite) {
    function LazyUint8Array () {
      this.lengthKnown = false
      this.chunks = []
    }
    LazyUint8Array.prototype.get = function LazyUint8Array_get (idx) {
      if (idx > this.length - 1 || idx < 0) {
        return undefined
      }
      var chunkOffset = idx % this.chunkSize
      var chunkNum = (idx / this.chunkSize) | 0
      return this.getter(chunkNum)[chunkOffset]
    }
    LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter (
      getter
    ) {
      this.getter = getter
    }
    LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength () {
      var xhr = new XMLHttpRequest()
      xhr.open('HEAD', url, false)
      xhr.send(null)
      if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
        throw new Error("Couldn't load " + url + '. Status: ' + xhr.status)
      var datalength = Number(xhr.getResponseHeader('Content-length'))
      var header
      var hasByteServing =
        (header = xhr.getResponseHeader('Accept-Ranges')) && header === 'bytes'
      var usesGzip =
        (header = xhr.getResponseHeader('Content-Encoding')) &&
        header === 'gzip'
      var chunkSize = 1024 * 1024
      if (!hasByteServing) chunkSize = datalength
      var doXHR = function (from, to) {
        if (from > to)
          throw new Error(
            'invalid range (' + from + ', ' + to + ') or no bytes requested!'
          )
        if (to > datalength - 1)
          throw new Error(
            'only ' + datalength + ' bytes available! programmer error!'
          )
        var xhr = new XMLHttpRequest()
        xhr.open('GET', url, false)
        if (datalength !== chunkSize)
          xhr.setRequestHeader('Range', 'bytes=' + from + '-' + to)
        if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer'
        if (xhr.overrideMimeType) {
          xhr.overrideMimeType('text/plain; charset=x-user-defined')
        }
        xhr.send(null)
        if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
          throw new Error("Couldn't load " + url + '. Status: ' + xhr.status)
        if (xhr.response !== undefined) {
          return new Uint8Array(xhr.response || [])
        } else {
          return intArrayFromString(xhr.responseText || '', true)
        }
      }
      var lazyArray = this
      lazyArray.setDataGetter(function (chunkNum) {
        var start = chunkNum * chunkSize
        var end = (chunkNum + 1) * chunkSize - 1
        end = Math.min(end, datalength - 1)
        if (typeof lazyArray.chunks[chunkNum] === 'undefined') {
          lazyArray.chunks[chunkNum] = doXHR(start, end)
        }
        if (typeof lazyArray.chunks[chunkNum] === 'undefined')
          throw new Error('doXHR failed!')
        return lazyArray.chunks[chunkNum]
      })
      if (usesGzip || !datalength) {
        chunkSize = datalength = 1
        datalength = this.getter(0).length
        chunkSize = datalength
        console.log(
          'LazyFiles on gzip forces download of the whole file when length is accessed'
        )
      }
      this._length = datalength
      this._chunkSize = chunkSize
      this.lengthKnown = true
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      if (!ENVIRONMENT_IS_WORKER)
        throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc'
      var lazyArray = new LazyUint8Array()
      Object.defineProperties(lazyArray, {
        length: {
          get: function () {
            if (!this.lengthKnown) {
              this.cacheLength()
            }
            return this._length
          }
        },
        chunkSize: {
          get: function () {
            if (!this.lengthKnown) {
              this.cacheLength()
            }
            return this._chunkSize
          }
        }
      })
      var properties = { isDevice: false, contents: lazyArray }
    } else {
      var properties = { isDevice: false, url: url }
    }
    var node = FS.createFile(parent, name, properties, canRead, canWrite)
    if (properties.contents) {
      node.contents = properties.contents
    } else if (properties.url) {
      node.contents = null
      node.url = properties.url
    }
    Object.defineProperties(node, {
      usedBytes: {
        get: function () {
          return this.contents.length
        }
      }
    })
    var stream_ops = {}
    var keys = Object.keys(node.stream_ops)
    keys.forEach(function (key) {
      var fn = node.stream_ops[key]
      stream_ops[key] = function forceLoadLazyFile () {
        if (!FS.forceLoadFile(node)) {
          throw new FS.ErrnoError(5)
        }
        return fn.apply(null, arguments)
      }
    })
    stream_ops.read = function stream_ops_read (
      stream,
      buffer,
      offset,
      length,
      position
    ) {
      if (!FS.forceLoadFile(node)) {
        throw new FS.ErrnoError(5)
      }
      var contents = stream.node.contents
      if (position >= contents.length) return 0
      var size = Math.min(contents.length - position, length)
      if (contents.slice) {
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents[position + i]
        }
      } else {
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents.get(position + i)
        }
      }
      return size
    }
    node.stream_ops = stream_ops
    return node
  },
  createPreloadedFile: function (
    parent,
    name,
    url,
    canRead,
    canWrite,
    onload,
    onerror,
    dontCreateFile,
    canOwn,
    preFinish
  ) {
    Browser.init()
    var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent
    var dep = getUniqueRunDependency('cp ' + fullname)
    function processData (byteArray) {
      function finish (byteArray) {
        if (preFinish) preFinish()
        if (!dontCreateFile) {
          FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
        }
        if (onload) onload()
        removeRunDependency(dep)
      }
      var handled = false
      Module['preloadPlugins'].forEach(function (plugin) {
        if (handled) return
        if (plugin['canHandle'](fullname)) {
          plugin['handle'](byteArray, fullname, finish, function () {
            if (onerror) onerror()
            removeRunDependency(dep)
          })
          handled = true
        }
      })
      if (!handled) finish(byteArray)
    }
    addRunDependency(dep)
    if (typeof url == 'string') {
      Browser.asyncLoad(
        url,
        function (byteArray) {
          processData(byteArray)
        },
        onerror
      )
    } else {
      processData(url)
    }
  },
  indexedDB: function () {
    return (
      window.indexedDB ||
      window.mozIndexedDB ||
      window.webkitIndexedDB ||
      window.msIndexedDB
    )
  },
  DB_NAME: function () {
    return 'EM_FS_' + window.location.pathname
  },
  DB_VERSION: 20,
  DB_STORE_NAME: 'FILE_DATA',
  saveFilesToDB: function (paths, onload, onerror) {
    onload = onload || function () {}
    onerror = onerror || function () {}
    var indexedDB = FS.indexedDB()
    try {
      var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
    } catch (e) {
      return onerror(e)
    }
    openRequest.onupgradeneeded = function openRequest_onupgradeneeded () {
      console.log('creating db')
      var db = openRequest.result
      db.createObjectStore(FS.DB_STORE_NAME)
    }
    openRequest.onsuccess = function openRequest_onsuccess () {
      var db = openRequest.result
      var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite')
      var files = transaction.objectStore(FS.DB_STORE_NAME)
      var ok = 0,
        fail = 0,
        total = paths.length
      function finish () {
        if (fail == 0) onload()
        else onerror()
      }
      paths.forEach(function (path) {
        var putRequest = files.put(FS.analyzePath(path).object.contents, path)
        putRequest.onsuccess = function putRequest_onsuccess () {
          ok++
          if (ok + fail == total) finish()
        }
        putRequest.onerror = function putRequest_onerror () {
          fail++
          if (ok + fail == total) finish()
        }
      })
      transaction.onerror = onerror
    }
    openRequest.onerror = onerror
  },
  loadFilesFromDB: function (paths, onload, onerror) {
    onload = onload || function () {}
    onerror = onerror || function () {}
    var indexedDB = FS.indexedDB()
    try {
      var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
    } catch (e) {
      return onerror(e)
    }
    openRequest.onupgradeneeded = onerror
    openRequest.onsuccess = function openRequest_onsuccess () {
      var db = openRequest.result
      try {
        var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly')
      } catch (e) {
        onerror(e)
        return
      }
      var files = transaction.objectStore(FS.DB_STORE_NAME)
      var ok = 0,
        fail = 0,
        total = paths.length
      function finish () {
        if (fail == 0) onload()
        else onerror()
      }
      paths.forEach(function (path) {
        var getRequest = files.get(path)
        getRequest.onsuccess = function getRequest_onsuccess () {
          if (FS.analyzePath(path).exists) {
            FS.unlink(path)
          }
          FS.createDataFile(
            PATH.dirname(path),
            PATH.basename(path),
            getRequest.result,
            true,
            true,
            true
          )
          ok++
          if (ok + fail == total) finish()
        }
        getRequest.onerror = function getRequest_onerror () {
          fail++
          if (ok + fail == total) finish()
        }
      })
      transaction.onerror = onerror
    }
    openRequest.onerror = onerror
  }
}
var SYSCALLS = {
  DEFAULT_POLLMASK: 5,
  mappings: {},
  umask: 511,
  calculateAt: function (dirfd, path) {
    if (path[0] !== '/') {
      var dir
      if (dirfd === -100) {
        dir = FS.cwd()
      } else {
        var dirstream = FS.getStream(dirfd)
        if (!dirstream) throw new FS.ErrnoError(9)
        dir = dirstream.path
      }
      path = PATH.join2(dir, path)
    }
    return path
  },
  doStat: function (func, path, buf) {
    try {
      var stat = func(path)
    } catch (e) {
      if (
        e &&
        e.node &&
        PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))
      ) {
        return -20
      }
      throw e
    }
    HEAP32[buf >> 2] = stat.dev
    HEAP32[(buf + 4) >> 2] = 0
    HEAP32[(buf + 8) >> 2] = stat.ino
    HEAP32[(buf + 12) >> 2] = stat.mode
    HEAP32[(buf + 16) >> 2] = stat.nlink
    HEAP32[(buf + 20) >> 2] = stat.uid
    HEAP32[(buf + 24) >> 2] = stat.gid
    HEAP32[(buf + 28) >> 2] = stat.rdev
    HEAP32[(buf + 32) >> 2] = 0
    ;(tempI64 = [
      stat.size >>> 0,
      ((tempDouble = stat.size),
      +Math_abs(tempDouble) >= 1
        ? tempDouble > 0
          ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>>
            0
          : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>>
            0
        : 0)
    ]),
      (HEAP32[(buf + 40) >> 2] = tempI64[0]),
      (HEAP32[(buf + 44) >> 2] = tempI64[1])
    HEAP32[(buf + 48) >> 2] = 4096
    HEAP32[(buf + 52) >> 2] = stat.blocks
    HEAP32[(buf + 56) >> 2] = (stat.atime.getTime() / 1e3) | 0
    HEAP32[(buf + 60) >> 2] = 0
    HEAP32[(buf + 64) >> 2] = (stat.mtime.getTime() / 1e3) | 0
    HEAP32[(buf + 68) >> 2] = 0
    HEAP32[(buf + 72) >> 2] = (stat.ctime.getTime() / 1e3) | 0
    HEAP32[(buf + 76) >> 2] = 0
    ;(tempI64 = [
      stat.ino >>> 0,
      ((tempDouble = stat.ino),
      +Math_abs(tempDouble) >= 1
        ? tempDouble > 0
          ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>>
            0
          : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>>
            0
        : 0)
    ]),
      (HEAP32[(buf + 80) >> 2] = tempI64[0]),
      (HEAP32[(buf + 84) >> 2] = tempI64[1])
    return 0
  },
  doMsync: function (addr, stream, len, flags) {
    var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len))
    FS.msync(stream, buffer, 0, len, flags)
  },
  doMkdir: function (path, mode) {
    path = PATH.normalize(path)
    if (path[path.length - 1] === '/') path = path.substr(0, path.length - 1)
    FS.mkdir(path, mode, 0)
    return 0
  },
  doMknod: function (path, mode, dev) {
    switch (mode & 61440) {
      case 32768:
      case 8192:
      case 24576:
      case 4096:
      case 49152:
        break
      default:
        return -22
    }
    FS.mknod(path, mode, dev)
    return 0
  },
  doReadlink: function (path, buf, bufsize) {
    if (bufsize <= 0) return -22
    var ret = FS.readlink(path)
    var len = Math.min(bufsize, lengthBytesUTF8(ret))
    var endChar = HEAP8[buf + len]
    stringToUTF8(ret, buf, bufsize + 1)
    HEAP8[buf + len] = endChar
    return len
  },
  doAccess: function (path, amode) {
    if (amode & ~7) {
      return -22
    }
    var node
    var lookup = FS.lookupPath(path, { follow: true })
    node = lookup.node
    if (!node) {
      return -2
    }
    var perms = ''
    if (amode & 4) perms += 'r'
    if (amode & 2) perms += 'w'
    if (amode & 1) perms += 'x'
    if (perms && FS.nodePermissions(node, perms)) {
      return -13
    }
    return 0
  },
  doDup: function (path, flags, suggestFD) {
    var suggest = FS.getStream(suggestFD)
    if (suggest) FS.close(suggest)
    return FS.open(path, flags, 0, suggestFD, suggestFD).fd
  },
  doReadv: function (stream, iov, iovcnt, offset) {
    var ret = 0
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAP32[(iov + i * 8) >> 2]
      var len = HEAP32[(iov + (i * 8 + 4)) >> 2]
      var curr = FS.read(stream, HEAP8, ptr, len, offset)
      if (curr < 0) return -1
      ret += curr
      if (curr < len) break
    }
    return ret
  },
  doWritev: function (stream, iov, iovcnt, offset) {
    var ret = 0
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAP32[(iov + i * 8) >> 2]
      var len = HEAP32[(iov + (i * 8 + 4)) >> 2]
      var curr = FS.write(stream, HEAP8, ptr, len, offset)
      if (curr < 0) return -1
      ret += curr
    }
    return ret
  },
  varargs: 0,
  get: function (varargs) {
    SYSCALLS.varargs += 4
    var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2]
    return ret
  },
  getStr: function () {
    var ret = UTF8ToString(SYSCALLS.get())
    return ret
  },
  getStreamFromFD: function () {
    var stream = FS.getStream(SYSCALLS.get())
    if (!stream) throw new FS.ErrnoError(9)
    return stream
  },
  get64: function () {
    var low = SYSCALLS.get(),
      high = SYSCALLS.get()
    return low
  },
  getZero: function () {
    SYSCALLS.get()
  }
}
function ___syscall10 (which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var path = SYSCALLS.getStr()
    FS.unlink(path)
    return 0
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function ___syscall140 (which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      offset_high = SYSCALLS.get(),
      offset_low = SYSCALLS.get(),
      result = SYSCALLS.get(),
      whence = SYSCALLS.get()
    var HIGH_OFFSET = 4294967296
    var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0)
    var DOUBLE_LIMIT = 9007199254740992
    if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
      return -75
    }
    FS.llseek(stream, offset, whence)
    ;(tempI64 = [
      stream.position >>> 0,
      ((tempDouble = stream.position),
      +Math_abs(tempDouble) >= 1
        ? tempDouble > 0
          ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>>
            0
          : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>>
            0
        : 0)
    ]),
      (HEAP32[result >> 2] = tempI64[0]),
      (HEAP32[(result + 4) >> 2] = tempI64[1])
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null
    return 0
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function ___syscall145 (which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      iov = SYSCALLS.get(),
      iovcnt = SYSCALLS.get()
    return SYSCALLS.doReadv(stream, iov, iovcnt)
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function ___syscall183 (which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var buf = SYSCALLS.get(),
      size = SYSCALLS.get()
    if (size === 0) return -22
    var cwd = FS.cwd()
    var cwdLengthInBytes = lengthBytesUTF8(cwd)
    if (size < cwdLengthInBytes + 1) return -34
    stringToUTF8(cwd, buf, size)
    return buf
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function ___syscall221 (which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      cmd = SYSCALLS.get()
    switch (cmd) {
      case 0: {
        var arg = SYSCALLS.get()
        if (arg < 0) {
          return -22
        }
        var newStream
        newStream = FS.open(stream.path, stream.flags, 0, arg)
        return newStream.fd
      }
      case 1:
      case 2:
        return 0
      case 3:
        return stream.flags
      case 4: {
        var arg = SYSCALLS.get()
        stream.flags |= arg
        return 0
      }
      case 12: {
        var arg = SYSCALLS.get()
        var offset = 0
        HEAP16[(arg + offset) >> 1] = 2
        return 0
      }
      case 13:
      case 14:
        return 0
      case 16:
      case 8:
        return -22
      case 9:
        ___setErrNo(22)
        return -1
      default: {
        return -22
      }
    }
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function ___syscall40 (which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var path = SYSCALLS.getStr()
    FS.rmdir(path)
    return 0
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function ___syscall5 (which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var pathname = SYSCALLS.getStr(),
      flags = SYSCALLS.get(),
      mode = SYSCALLS.get()
    var stream = FS.open(pathname, flags, mode)
    return stream.fd
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function ___syscall54 (which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      op = SYSCALLS.get()
    switch (op) {
      case 21509:
      case 21505: {
        if (!stream.tty) return -25
        return 0
      }
      case 21510:
      case 21511:
      case 21512:
      case 21506:
      case 21507:
      case 21508: {
        if (!stream.tty) return -25
        return 0
      }
      case 21519: {
        if (!stream.tty) return -25
        var argp = SYSCALLS.get()
        HEAP32[argp >> 2] = 0
        return 0
      }
      case 21520: {
        if (!stream.tty) return -25
        return -22
      }
      case 21531: {
        var argp = SYSCALLS.get()
        return FS.ioctl(stream, op, argp)
      }
      case 21523: {
        if (!stream.tty) return -25
        return 0
      }
      case 21524: {
        if (!stream.tty) return -25
        return 0
      }
      default:
        abort('bad ioctl syscall ' + op)
    }
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function ___syscall6 (which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var stream = SYSCALLS.getStreamFromFD()
    FS.close(stream)
    return 0
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function __emscripten_syscall_munmap (addr, len) {
  if (addr === -1 || len === 0) {
    return -22
  }
  var info = SYSCALLS.mappings[addr]
  if (!info) return 0
  if (len === info.len) {
    var stream = FS.getStream(info.fd)
    SYSCALLS.doMsync(addr, stream, len, info.flags)
    FS.munmap(stream)
    SYSCALLS.mappings[addr] = null
    if (info.allocated) {
      _free(info.malloc)
    }
  }
  return 0
}
function ___syscall91 (which, varargs) {
  SYSCALLS.varargs = varargs
  try {
    var addr = SYSCALLS.get(),
      len = SYSCALLS.get()
    return __emscripten_syscall_munmap(addr, len)
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function ___unlock () {}
function getShiftFromSize (size) {
  switch (size) {
    case 1:
      return 0
    case 2:
      return 1
    case 4:
      return 2
    case 8:
      return 3
    default:
      throw new TypeError('Unknown type size: ' + size)
  }
}
function embind_init_charCodes () {
  var codes = new Array(256)
  for (var i = 0; i < 256; ++i) {
    codes[i] = String.fromCharCode(i)
  }
  embind_charCodes = codes
}
var embind_charCodes = undefined
function readLatin1String (ptr) {
  var ret = ''
  var c = ptr
  while (HEAPU8[c]) {
    ret += embind_charCodes[HEAPU8[c++]]
  }
  return ret
}
var awaitingDependencies = {}
var registeredTypes = {}
var typeDependencies = {}
var char_0 = 48
var char_9 = 57
function makeLegalFunctionName (name) {
  if (undefined === name) {
    return '_unknown'
  }
  name = name.replace(/[^a-zA-Z0-9_]/g, '$')
  var f = name.charCodeAt(0)
  if (f >= char_0 && f <= char_9) {
    return '_' + name
  } else {
    return name
  }
}
function createNamedFunction (name, body) {
  name = makeLegalFunctionName(name)
  return new Function(
    'body',
    'return function ' +
      name +
      '() {\n' +
      '    "use strict";' +
      '    return body.apply(this, arguments);\n' +
      '};\n'
  )(body)
}
function extendError (baseErrorType, errorName) {
  var errorClass = createNamedFunction(errorName, function (message) {
    this.name = errorName
    this.message = message
    var stack = new Error(message).stack
    if (stack !== undefined) {
      this.stack =
        this.toString() + '\n' + stack.replace(/^Error(:[^\n]*)?\n/, '')
    }
  })
  errorClass.prototype = Object.create(baseErrorType.prototype)
  errorClass.prototype.constructor = errorClass
  errorClass.prototype.toString = function () {
    if (this.message === undefined) {
      return this.name
    } else {
      return this.name + ': ' + this.message
    }
  }
  return errorClass
}
var BindingError = undefined
function throwBindingError (message) {
  throw new BindingError(message)
}
var InternalError = undefined
function throwInternalError (message) {
  throw new InternalError(message)
}
function whenDependentTypesAreResolved (
  myTypes,
  dependentTypes,
  getTypeConverters
) {
  myTypes.forEach(function (type) {
    typeDependencies[type] = dependentTypes
  })
  function onComplete (typeConverters) {
    var myTypeConverters = getTypeConverters(typeConverters)
    if (myTypeConverters.length !== myTypes.length) {
      throwInternalError('Mismatched type converter count')
    }
    for (var i = 0; i < myTypes.length; ++i) {
      registerType(myTypes[i], myTypeConverters[i])
    }
  }
  var typeConverters = new Array(dependentTypes.length)
  var unregisteredTypes = []
  var registered = 0
  dependentTypes.forEach(function (dt, i) {
    if (registeredTypes.hasOwnProperty(dt)) {
      typeConverters[i] = registeredTypes[dt]
    } else {
      unregisteredTypes.push(dt)
      if (!awaitingDependencies.hasOwnProperty(dt)) {
        awaitingDependencies[dt] = []
      }
      awaitingDependencies[dt].push(function () {
        typeConverters[i] = registeredTypes[dt]
        ++registered
        if (registered === unregisteredTypes.length) {
          onComplete(typeConverters)
        }
      })
    }
  })
  if (0 === unregisteredTypes.length) {
    onComplete(typeConverters)
  }
}
function registerType (rawType, registeredInstance, options) {
  options = options || {}
  if (!('argPackAdvance' in registeredInstance)) {
    throw new TypeError(
      'registerType registeredInstance requires argPackAdvance'
    )
  }
  var name = registeredInstance.name
  if (!rawType) {
    throwBindingError(
      'type "' + name + '" must have a positive integer typeid pointer'
    )
  }
  if (registeredTypes.hasOwnProperty(rawType)) {
    if (options.ignoreDuplicateRegistrations) {
      return
    } else {
      throwBindingError("Cannot register type '" + name + "' twice")
    }
  }
  registeredTypes[rawType] = registeredInstance
  delete typeDependencies[rawType]
  if (awaitingDependencies.hasOwnProperty(rawType)) {
    var callbacks = awaitingDependencies[rawType]
    delete awaitingDependencies[rawType]
    callbacks.forEach(function (cb) {
      cb()
    })
  }
}
function __embind_register_bool (rawType, name, size, trueValue, falseValue) {
  var shift = getShiftFromSize(size)
  name = readLatin1String(name)
  registerType(rawType, {
    name: name,
    fromWireType: function (wt) {
      return !!wt
    },
    toWireType: function (destructors, o) {
      return o ? trueValue : falseValue
    },
    argPackAdvance: 8,
    readValueFromPointer: function (pointer) {
      var heap
      if (size === 1) {
        heap = HEAP8
      } else if (size === 2) {
        heap = HEAP16
      } else if (size === 4) {
        heap = HEAP32
      } else {
        throw new TypeError('Unknown boolean type size: ' + name)
      }
      return this['fromWireType'](heap[pointer >> shift])
    },
    destructorFunction: null
  })
}
var emval_free_list = []
var emval_handle_array = [
  {},
  { value: undefined },
  { value: null },
  { value: true },
  { value: false }
]
function __emval_decref (handle) {
  if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
    emval_handle_array[handle] = undefined
    emval_free_list.push(handle)
  }
}
function count_emval_handles () {
  var count = 0
  for (var i = 5; i < emval_handle_array.length; ++i) {
    if (emval_handle_array[i] !== undefined) {
      ++count
    }
  }
  return count
}
function get_first_emval () {
  for (var i = 5; i < emval_handle_array.length; ++i) {
    if (emval_handle_array[i] !== undefined) {
      return emval_handle_array[i]
    }
  }
  return null
}
function init_emval () {
  Module['count_emval_handles'] = count_emval_handles
  Module['get_first_emval'] = get_first_emval
}
function __emval_register (value) {
  switch (value) {
    case undefined: {
      return 1
    }
    case null: {
      return 2
    }
    case true: {
      return 3
    }
    case false: {
      return 4
    }
    default: {
      var handle = emval_free_list.length
        ? emval_free_list.pop()
        : emval_handle_array.length
      emval_handle_array[handle] = { refcount: 1, value: value }
      return handle
    }
  }
}
function simpleReadValueFromPointer (pointer) {
  return this['fromWireType'](HEAPU32[pointer >> 2])
}
function __embind_register_emval (rawType, name) {
  name = readLatin1String(name)
  registerType(rawType, {
    name: name,
    fromWireType: function (handle) {
      var rv = emval_handle_array[handle].value
      __emval_decref(handle)
      return rv
    },
    toWireType: function (destructors, value) {
      return __emval_register(value)
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: null
  })
}
function _embind_repr (v) {
  if (v === null) {
    return 'null'
  }
  var t = typeof v
  if (t === 'object' || t === 'array' || t === 'function') {
    return v.toString()
  } else {
    return '' + v
  }
}
function floatReadValueFromPointer (name, shift) {
  switch (shift) {
    case 2:
      return function (pointer) {
        return this['fromWireType'](HEAPF32[pointer >> 2])
      }
    case 3:
      return function (pointer) {
        return this['fromWireType'](HEAPF64[pointer >> 3])
      }
    default:
      throw new TypeError('Unknown float type: ' + name)
  }
}
function __embind_register_float (rawType, name, size) {
  var shift = getShiftFromSize(size)
  name = readLatin1String(name)
  registerType(rawType, {
    name: name,
    fromWireType: function (value) {
      return value
    },
    toWireType: function (destructors, value) {
      if (typeof value !== 'number' && typeof value !== 'boolean') {
        throw new TypeError(
          'Cannot convert "' + _embind_repr(value) + '" to ' + this.name
        )
      }
      return value
    },
    argPackAdvance: 8,
    readValueFromPointer: floatReadValueFromPointer(name, shift),
    destructorFunction: null
  })
}
function integerReadValueFromPointer (name, shift, signed) {
  switch (shift) {
    case 0:
      return signed
        ? function readS8FromPointer (pointer) {
            return HEAP8[pointer]
          }
        : function readU8FromPointer (pointer) {
            return HEAPU8[pointer]
          }
    case 1:
      return signed
        ? function readS16FromPointer (pointer) {
            return HEAP16[pointer >> 1]
          }
        : function readU16FromPointer (pointer) {
            return HEAPU16[pointer >> 1]
          }
    case 2:
      return signed
        ? function readS32FromPointer (pointer) {
            return HEAP32[pointer >> 2]
          }
        : function readU32FromPointer (pointer) {
            return HEAPU32[pointer >> 2]
          }
    default:
      throw new TypeError('Unknown integer type: ' + name)
  }
}
function __embind_register_integer (
  primitiveType,
  name,
  size,
  minRange,
  maxRange
) {
  name = readLatin1String(name)
  if (maxRange === -1) {
    maxRange = 4294967295
  }
  var shift = getShiftFromSize(size)
  var fromWireType = function (value) {
    return value
  }
  if (minRange === 0) {
    var bitshift = 32 - 8 * size
    fromWireType = function (value) {
      return (value << bitshift) >>> bitshift
    }
  }
  var isUnsignedType = name.indexOf('unsigned') != -1
  registerType(primitiveType, {
    name: name,
    fromWireType: fromWireType,
    toWireType: function (destructors, value) {
      if (typeof value !== 'number' && typeof value !== 'boolean') {
        throw new TypeError(
          'Cannot convert "' + _embind_repr(value) + '" to ' + this.name
        )
      }
      if (value < minRange || value > maxRange) {
        throw new TypeError(
          'Passing a number "' +
            _embind_repr(value) +
            '" from JS side to C/C++ side to an argument of type "' +
            name +
            '", which is outside the valid range [' +
            minRange +
            ', ' +
            maxRange +
            ']!'
        )
      }
      return isUnsignedType ? value >>> 0 : value | 0
    },
    argPackAdvance: 8,
    readValueFromPointer: integerReadValueFromPointer(
      name,
      shift,
      minRange !== 0
    ),
    destructorFunction: null
  })
}
function __embind_register_memory_view (rawType, dataTypeIndex, name) {
  var typeMapping = [
    Int8Array,
    Uint8Array,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array
  ]
  var TA = typeMapping[dataTypeIndex]
  function decodeMemoryView (handle) {
    handle = handle >> 2
    var heap = HEAPU32
    var size = heap[handle]
    var data = heap[handle + 1]
    return new TA(heap['buffer'], data, size)
  }
  name = readLatin1String(name)
  registerType(
    rawType,
    {
      name: name,
      fromWireType: decodeMemoryView,
      argPackAdvance: 8,
      readValueFromPointer: decodeMemoryView
    },
    { ignoreDuplicateRegistrations: true }
  )
}
function __embind_register_std_string (rawType, name) {
  name = readLatin1String(name)
  var stdStringIsUTF8 = name === 'std::string'
  registerType(rawType, {
    name: name,
    fromWireType: function (value) {
      var length = HEAPU32[value >> 2]
      var str
      if (stdStringIsUTF8) {
        var endChar = HEAPU8[value + 4 + length]
        var endCharSwap = 0
        if (endChar != 0) {
          endCharSwap = endChar
          HEAPU8[value + 4 + length] = 0
        }
        var decodeStartPtr = value + 4
        for (var i = 0; i <= length; ++i) {
          var currentBytePtr = value + 4 + i
          if (HEAPU8[currentBytePtr] == 0) {
            var stringSegment = UTF8ToString(decodeStartPtr)
            if (str === undefined) str = stringSegment
            else {
              str += String.fromCharCode(0)
              str += stringSegment
            }
            decodeStartPtr = currentBytePtr + 1
          }
        }
        if (endCharSwap != 0) HEAPU8[value + 4 + length] = endCharSwap
      } else {
        var a = new Array(length)
        for (var i = 0; i < length; ++i) {
          a[i] = String.fromCharCode(HEAPU8[value + 4 + i])
        }
        str = a.join('')
      }
      _free(value)
      return str
    },
    toWireType: function (destructors, value) {
      if (value instanceof ArrayBuffer) {
        value = new Uint8Array(value)
      }
      var getLength
      var valueIsOfTypeString = typeof value === 'string'
      if (
        !(
          valueIsOfTypeString ||
          value instanceof Uint8Array ||
          value instanceof Uint8ClampedArray ||
          value instanceof Int8Array
        )
      ) {
        throwBindingError('Cannot pass non-string to std::string')
      }
      if (stdStringIsUTF8 && valueIsOfTypeString) {
        getLength = function () {
          return lengthBytesUTF8(value)
        }
      } else {
        getLength = function () {
          return value.length
        }
      }
      var length = getLength()
      var ptr = _malloc(4 + length + 1)
      HEAPU32[ptr >> 2] = length
      if (stdStringIsUTF8 && valueIsOfTypeString) {
        stringToUTF8(value, ptr + 4, length + 1)
      } else {
        if (valueIsOfTypeString) {
          for (var i = 0; i < length; ++i) {
            var charCode = value.charCodeAt(i)
            if (charCode > 255) {
              _free(ptr)
              throwBindingError(
                'String has UTF-16 code units that do not fit in 8 bits'
              )
            }
            HEAPU8[ptr + 4 + i] = charCode
          }
        } else {
          for (var i = 0; i < length; ++i) {
            HEAPU8[ptr + 4 + i] = value[i]
          }
        }
      }
      if (destructors !== null) {
        destructors.push(_free, ptr)
      }
      return ptr
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: function (ptr) {
      _free(ptr)
    }
  })
}
function __embind_register_std_wstring (rawType, charSize, name) {
  name = readLatin1String(name)
  var getHeap, shift
  if (charSize === 2) {
    getHeap = function () {
      return HEAPU16
    }
    shift = 1
  } else if (charSize === 4) {
    getHeap = function () {
      return HEAPU32
    }
    shift = 2
  }
  registerType(rawType, {
    name: name,
    fromWireType: function (value) {
      var HEAP = getHeap()
      var length = HEAPU32[value >> 2]
      var a = new Array(length)
      var start = (value + 4) >> shift
      for (var i = 0; i < length; ++i) {
        a[i] = String.fromCharCode(HEAP[start + i])
      }
      _free(value)
      return a.join('')
    },
    toWireType: function (destructors, value) {
      var length = value.length
      var ptr = _malloc(4 + length * charSize)
      var HEAP = getHeap()
      HEAPU32[ptr >> 2] = length
      var start = (ptr + 4) >> shift
      for (var i = 0; i < length; ++i) {
        HEAP[start + i] = value.charCodeAt(i)
      }
      if (destructors !== null) {
        destructors.push(_free, ptr)
      }
      return ptr
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: function (ptr) {
      _free(ptr)
    }
  })
}
function __embind_register_void (rawType, name) {
  name = readLatin1String(name)
  registerType(rawType, {
    isVoid: true,
    name: name,
    argPackAdvance: 0,
    fromWireType: function () {
      return undefined
    },
    toWireType: function (destructors, o) {
      return undefined
    }
  })
}
function _emscripten_set_main_loop_timing (mode, value) {
  Browser.mainLoop.timingMode = mode
  Browser.mainLoop.timingValue = value
  if (!Browser.mainLoop.func) {
    return 1
  }
  if (mode == 0) {
    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout () {
      var timeUntilNextTick =
        Math.max(
          0,
          Browser.mainLoop.tickStartTime + value - _emscripten_get_now()
        ) | 0
      setTimeout(Browser.mainLoop.runner, timeUntilNextTick)
    }
    Browser.mainLoop.method = 'timeout'
  } else if (mode == 1) {
    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF () {
      Browser.requestAnimationFrame(Browser.mainLoop.runner)
    }
    Browser.mainLoop.method = 'rAF'
  } else if (mode == 2) {
    if (typeof setImmediate === 'undefined') {
      var setImmediates = []
      var emscriptenMainLoopMessageId = 'setimmediate'
      var Browser_setImmediate_messageHandler = function (event) {
        if (
          event.data === emscriptenMainLoopMessageId ||
          event.data.target === emscriptenMainLoopMessageId
        ) {
          event.stopPropagation()
          setImmediates.shift()()
        }
      }
      addEventListener('message', Browser_setImmediate_messageHandler, true)
      setImmediate = function Browser_emulated_setImmediate (func) {
        setImmediates.push(func)
        if (ENVIRONMENT_IS_WORKER) {
          if (Module['setImmediates'] === undefined)
            Module['setImmediates'] = []
          Module['setImmediates'].push(func)
          postMessage({ target: emscriptenMainLoopMessageId })
        } else postMessage(emscriptenMainLoopMessageId, '*')
      }
    }
    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate () {
      setImmediate(Browser.mainLoop.runner)
    }
    Browser.mainLoop.method = 'immediate'
  }
  return 0
}
function _emscripten_get_now () {
  abort()
}
function _emscripten_set_main_loop (
  func,
  fps,
  simulateInfiniteLoop,
  arg,
  noSetTiming
) {
  noExitRuntime = true
  assert(
    !Browser.mainLoop.func,
    'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.'
  )
  Browser.mainLoop.func = func
  Browser.mainLoop.arg = arg
  var browserIterationFunc
  if (typeof arg !== 'undefined') {
    browserIterationFunc = function () {
      Module['dynCall_vi'](func, arg)
    }
  } else {
    browserIterationFunc = function () {
      Module['dynCall_v'](func)
    }
  }
  var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop
  Browser.mainLoop.runner = function Browser_mainLoop_runner () {
    if (ABORT) return
    if (Browser.mainLoop.queue.length > 0) {
      var start = Date.now()
      var blocker = Browser.mainLoop.queue.shift()
      blocker.func(blocker.arg)
      if (Browser.mainLoop.remainingBlockers) {
        var remaining = Browser.mainLoop.remainingBlockers
        var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining)
        if (blocker.counted) {
          Browser.mainLoop.remainingBlockers = next
        } else {
          next = next + 0.5
          Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9
        }
      }
      console.log(
        'main loop blocker "' +
          blocker.name +
          '" took ' +
          (Date.now() - start) +
          ' ms'
      )
      Browser.mainLoop.updateStatus()
      if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return
      setTimeout(Browser.mainLoop.runner, 0)
      return
    }
    if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return
    Browser.mainLoop.currentFrameNumber =
      (Browser.mainLoop.currentFrameNumber + 1) | 0
    if (
      Browser.mainLoop.timingMode == 1 &&
      Browser.mainLoop.timingValue > 1 &&
      Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0
    ) {
      Browser.mainLoop.scheduler()
      return
    } else if (Browser.mainLoop.timingMode == 0) {
      Browser.mainLoop.tickStartTime = _emscripten_get_now()
    }
    if (Browser.mainLoop.method === 'timeout' && Module.ctx) {
      err(
        'Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!'
      )
      Browser.mainLoop.method = ''
    }
    Browser.mainLoop.runIter(browserIterationFunc)
    if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return
    if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData)
      SDL.audio.queueNewAudioData()
    Browser.mainLoop.scheduler()
  }
  if (!noSetTiming) {
    if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps)
    else _emscripten_set_main_loop_timing(1, 1)
    Browser.mainLoop.scheduler()
  }
  if (simulateInfiniteLoop) {
    throw 'SimulateInfiniteLoop'
  }
}
var Browser = {
  mainLoop: {
    scheduler: null,
    method: '',
    currentlyRunningMainloop: 0,
    func: null,
    arg: 0,
    timingMode: 0,
    timingValue: 0,
    currentFrameNumber: 0,
    queue: [],
    pause: function () {
      Browser.mainLoop.scheduler = null
      Browser.mainLoop.currentlyRunningMainloop++
    },
    resume: function () {
      Browser.mainLoop.currentlyRunningMainloop++
      var timingMode = Browser.mainLoop.timingMode
      var timingValue = Browser.mainLoop.timingValue
      var func = Browser.mainLoop.func
      Browser.mainLoop.func = null
      _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true)
      _emscripten_set_main_loop_timing(timingMode, timingValue)
      Browser.mainLoop.scheduler()
    },
    updateStatus: function () {
      if (Module['setStatus']) {
        var message = Module['statusMessage'] || 'Please wait...'
        var remaining = Browser.mainLoop.remainingBlockers
        var expected = Browser.mainLoop.expectedBlockers
        if (remaining) {
          if (remaining < expected) {
            Module['setStatus'](
              message + ' (' + (expected - remaining) + '/' + expected + ')'
            )
          } else {
            Module['setStatus'](message)
          }
        } else {
          Module['setStatus']('')
        }
      }
    },
    runIter: function (func) {
      if (ABORT) return
      if (Module['preMainLoop']) {
        var preRet = Module['preMainLoop']()
        if (preRet === false) {
          return
        }
      }
      try {
        func()
      } catch (e) {
        if (e instanceof ExitStatus) {
          return
        } else {
          if (e && typeof e === 'object' && e.stack)
            err('exception thrown: ' + [e, e.stack])
          throw e
        }
      }
      if (Module['postMainLoop']) Module['postMainLoop']()
    }
  },
  isFullscreen: false,
  pointerLock: false,
  moduleContextCreatedCallbacks: [],
  workers: [],
  init: function () {
    if (!Module['preloadPlugins']) Module['preloadPlugins'] = []
    if (Browser.initted) return
    Browser.initted = true
    try {
      new Blob()
      Browser.hasBlobConstructor = true
    } catch (e) {
      Browser.hasBlobConstructor = false
      console.log(
        'warning: no blob constructor, cannot create blobs with mimetypes'
      )
    }
    Browser.BlobBuilder =
      typeof MozBlobBuilder != 'undefined'
        ? MozBlobBuilder
        : typeof WebKitBlobBuilder != 'undefined'
        ? WebKitBlobBuilder
        : !Browser.hasBlobConstructor
        ? console.log('warning: no BlobBuilder')
        : null
    Browser.URLObject =
      typeof window != 'undefined'
        ? window.URL
          ? window.URL
          : window.webkitURL
        : undefined
    if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
      console.log(
        'warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.'
      )
      Module.noImageDecoding = true
    }
    var imagePlugin = {}
    imagePlugin['canHandle'] = function imagePlugin_canHandle (name) {
      return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name)
    }
    imagePlugin['handle'] = function imagePlugin_handle (
      byteArray,
      name,
      onload,
      onerror
    ) {
      var b = null
      if (Browser.hasBlobConstructor) {
        try {
          b = new Blob([byteArray], { type: Browser.getMimetype(name) })
          if (b.size !== byteArray.length) {
            b = new Blob([new Uint8Array(byteArray).buffer], {
              type: Browser.getMimetype(name)
            })
          }
        } catch (e) {
          warnOnce(
            'Blob constructor present but fails: ' +
              e +
              '; falling back to blob builder'
          )
        }
      }
      if (!b) {
        var bb = new Browser.BlobBuilder()
        bb.append(new Uint8Array(byteArray).buffer)
        b = bb.getBlob()
      }
      var url = Browser.URLObject.createObjectURL(b)
      var img = new Image()
      img.onload = function img_onload () {
        assert(img.complete, 'Image ' + name + ' could not be decoded')
        var canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        var ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        Module['preloadedImages'][name] = canvas
        Browser.URLObject.revokeObjectURL(url)
        if (onload) onload(byteArray)
      }
      img.onerror = function img_onerror (event) {
        console.log('Image ' + url + ' could not be decoded')
        if (onerror) onerror()
      }
      img.src = url
    }
    Module['preloadPlugins'].push(imagePlugin)
    var audioPlugin = {}
    audioPlugin['canHandle'] = function audioPlugin_canHandle (name) {
      return (
        !Module.noAudioDecoding &&
        name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 }
      )
    }
    audioPlugin['handle'] = function audioPlugin_handle (
      byteArray,
      name,
      onload,
      onerror
    ) {
      var done = false
      function finish (audio) {
        if (done) return
        done = true
        Module['preloadedAudios'][name] = audio
        if (onload) onload(byteArray)
      }
      function fail () {
        if (done) return
        done = true
        Module['preloadedAudios'][name] = new Audio()
        if (onerror) onerror()
      }
      if (Browser.hasBlobConstructor) {
        try {
          var b = new Blob([byteArray], { type: Browser.getMimetype(name) })
        } catch (e) {
          return fail()
        }
        var url = Browser.URLObject.createObjectURL(b)
        var audio = new Audio()
        audio.addEventListener(
          'canplaythrough',
          function () {
            finish(audio)
          },
          false
        )
        audio.onerror = function audio_onerror (event) {
          if (done) return
          console.log(
            'warning: browser could not fully decode audio ' +
              name +
              ', trying slower base64 approach'
          )
          function encode64 (data) {
            var BASE =
              'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
            var PAD = '='
            var ret = ''
            var leftchar = 0
            var leftbits = 0
            for (var i = 0; i < data.length; i++) {
              leftchar = (leftchar << 8) | data[i]
              leftbits += 8
              while (leftbits >= 6) {
                var curr = (leftchar >> (leftbits - 6)) & 63
                leftbits -= 6
                ret += BASE[curr]
              }
            }
            if (leftbits == 2) {
              ret += BASE[(leftchar & 3) << 4]
              ret += PAD + PAD
            } else if (leftbits == 4) {
              ret += BASE[(leftchar & 15) << 2]
              ret += PAD
            }
            return ret
          }
          audio.src =
            'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray)
          finish(audio)
        }
        audio.src = url
        Browser.safeSetTimeout(function () {
          finish(audio)
        }, 1e4)
      } else {
        return fail()
      }
    }
    Module['preloadPlugins'].push(audioPlugin)
    function pointerLockChange () {
      Browser.pointerLock =
        document['pointerLockElement'] === Module['canvas'] ||
        document['mozPointerLockElement'] === Module['canvas'] ||
        document['webkitPointerLockElement'] === Module['canvas'] ||
        document['msPointerLockElement'] === Module['canvas']
    }
    var canvas = Module['canvas']
    if (canvas) {
      canvas.requestPointerLock =
        canvas['requestPointerLock'] ||
        canvas['mozRequestPointerLock'] ||
        canvas['webkitRequestPointerLock'] ||
        canvas['msRequestPointerLock'] ||
        function () {}
      canvas.exitPointerLock =
        document['exitPointerLock'] ||
        document['mozExitPointerLock'] ||
        document['webkitExitPointerLock'] ||
        document['msExitPointerLock'] ||
        function () {}
      canvas.exitPointerLock = canvas.exitPointerLock.bind(document)
      document.addEventListener('pointerlockchange', pointerLockChange, false)
      document.addEventListener(
        'mozpointerlockchange',
        pointerLockChange,
        false
      )
      document.addEventListener(
        'webkitpointerlockchange',
        pointerLockChange,
        false
      )
      document.addEventListener('mspointerlockchange', pointerLockChange, false)
      if (Module['elementPointerLock']) {
        canvas.addEventListener(
          'click',
          function (ev) {
            if (!Browser.pointerLock && Module['canvas'].requestPointerLock) {
              Module['canvas'].requestPointerLock()
              ev.preventDefault()
            }
          },
          false
        )
      }
    }
  },
  createContext: function (
    canvas,
    useWebGL,
    setInModule,
    webGLContextAttributes
  ) {
    if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx
    var ctx
    var contextHandle
    if (useWebGL) {
      var contextAttributes = {
        antialias: false,
        alpha: false,
        majorVersion: 1
      }
      if (webGLContextAttributes) {
        for (var attribute in webGLContextAttributes) {
          contextAttributes[attribute] = webGLContextAttributes[attribute]
        }
      }
      if (typeof GL !== 'undefined') {
        contextHandle = GL.createContext(canvas, contextAttributes)
        if (contextHandle) {
          ctx = GL.getContext(contextHandle).GLctx
        }
      }
    } else {
      ctx = canvas.getContext('2d')
    }
    if (!ctx) return null
    if (setInModule) {
      if (!useWebGL)
        assert(
          typeof GLctx === 'undefined',
          'cannot set in module if GLctx is used, but we are a non-GL context that would replace it'
        )
      Module.ctx = ctx
      if (useWebGL) GL.makeContextCurrent(contextHandle)
      Module.useWebGL = useWebGL
      Browser.moduleContextCreatedCallbacks.forEach(function (callback) {
        callback()
      })
      Browser.init()
    }
    return ctx
  },
  destroyContext: function (canvas, useWebGL, setInModule) {},
  fullscreenHandlersInstalled: false,
  lockPointer: undefined,
  resizeCanvas: undefined,
  requestFullscreen: function (lockPointer, resizeCanvas, vrDevice) {
    Browser.lockPointer = lockPointer
    Browser.resizeCanvas = resizeCanvas
    Browser.vrDevice = vrDevice
    if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true
    if (typeof Browser.resizeCanvas === 'undefined')
      Browser.resizeCanvas = false
    if (typeof Browser.vrDevice === 'undefined') Browser.vrDevice = null
    var canvas = Module['canvas']
    function fullscreenChange () {
      Browser.isFullscreen = false
      var canvasContainer = canvas.parentNode
      if (
        (document['fullscreenElement'] ||
          document['mozFullScreenElement'] ||
          document['msFullscreenElement'] ||
          document['webkitFullscreenElement'] ||
          document['webkitCurrentFullScreenElement']) === canvasContainer
      ) {
        canvas.exitFullscreen = Browser.exitFullscreen
        if (Browser.lockPointer) canvas.requestPointerLock()
        Browser.isFullscreen = true
        if (Browser.resizeCanvas) {
          Browser.setFullscreenCanvasSize()
        } else {
          Browser.updateCanvasDimensions(canvas)
        }
      } else {
        canvasContainer.parentNode.insertBefore(canvas, canvasContainer)
        canvasContainer.parentNode.removeChild(canvasContainer)
        if (Browser.resizeCanvas) {
          Browser.setWindowedCanvasSize()
        } else {
          Browser.updateCanvasDimensions(canvas)
        }
      }
      if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullscreen)
      if (Module['onFullscreen']) Module['onFullscreen'](Browser.isFullscreen)
    }
    if (!Browser.fullscreenHandlersInstalled) {
      Browser.fullscreenHandlersInstalled = true
      document.addEventListener('fullscreenchange', fullscreenChange, false)
      document.addEventListener('mozfullscreenchange', fullscreenChange, false)
      document.addEventListener(
        'webkitfullscreenchange',
        fullscreenChange,
        false
      )
      document.addEventListener('MSFullscreenChange', fullscreenChange, false)
    }
    var canvasContainer = document.createElement('div')
    canvas.parentNode.insertBefore(canvasContainer, canvas)
    canvasContainer.appendChild(canvas)
    canvasContainer.requestFullscreen =
      canvasContainer['requestFullscreen'] ||
      canvasContainer['mozRequestFullScreen'] ||
      canvasContainer['msRequestFullscreen'] ||
      (canvasContainer['webkitRequestFullscreen']
        ? function () {
            canvasContainer['webkitRequestFullscreen'](
              Element['ALLOW_KEYBOARD_INPUT']
            )
          }
        : null) ||
      (canvasContainer['webkitRequestFullScreen']
        ? function () {
            canvasContainer['webkitRequestFullScreen'](
              Element['ALLOW_KEYBOARD_INPUT']
            )
          }
        : null)
    if (vrDevice) {
      canvasContainer.requestFullscreen({ vrDisplay: vrDevice })
    } else {
      canvasContainer.requestFullscreen()
    }
  },
  requestFullScreen: function (lockPointer, resizeCanvas, vrDevice) {
    err(
      'Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.'
    )
    Browser.requestFullScreen = function (lockPointer, resizeCanvas, vrDevice) {
      return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
    }
    return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
  },
  exitFullscreen: function () {
    if (!Browser.isFullscreen) {
      return false
    }
    var CFS =
      document['exitFullscreen'] ||
      document['cancelFullScreen'] ||
      document['mozCancelFullScreen'] ||
      document['msExitFullscreen'] ||
      document['webkitCancelFullScreen'] ||
      function () {}
    CFS.apply(document, [])
    return true
  },
  nextRAF: 0,
  fakeRequestAnimationFrame: function (func) {
    var now = Date.now()
    if (Browser.nextRAF === 0) {
      Browser.nextRAF = now + 1e3 / 60
    } else {
      while (now + 2 >= Browser.nextRAF) {
        Browser.nextRAF += 1e3 / 60
      }
    }
    var delay = Math.max(Browser.nextRAF - now, 0)
    setTimeout(func, delay)
  },
  requestAnimationFrame: function (func) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(func)
      return
    }
    var RAF = Browser.fakeRequestAnimationFrame
    RAF(func)
  },
  safeCallback: function (func) {
    return function () {
      if (!ABORT) return func.apply(null, arguments)
    }
  },
  allowAsyncCallbacks: true,
  queuedAsyncCallbacks: [],
  pauseAsyncCallbacks: function () {
    Browser.allowAsyncCallbacks = false
  },
  resumeAsyncCallbacks: function () {
    Browser.allowAsyncCallbacks = true
    if (Browser.queuedAsyncCallbacks.length > 0) {
      var callbacks = Browser.queuedAsyncCallbacks
      Browser.queuedAsyncCallbacks = []
      callbacks.forEach(function (func) {
        func()
      })
    }
  },
  safeRequestAnimationFrame: function (func) {
    return Browser.requestAnimationFrame(function () {
      if (ABORT) return
      if (Browser.allowAsyncCallbacks) {
        func()
      } else {
        Browser.queuedAsyncCallbacks.push(func)
      }
    })
  },
  safeSetTimeout: function (func, timeout) {
    noExitRuntime = true
    return setTimeout(function () {
      if (ABORT) return
      if (Browser.allowAsyncCallbacks) {
        func()
      } else {
        Browser.queuedAsyncCallbacks.push(func)
      }
    }, timeout)
  },
  safeSetInterval: function (func, timeout) {
    noExitRuntime = true
    return setInterval(function () {
      if (ABORT) return
      if (Browser.allowAsyncCallbacks) {
        func()
      }
    }, timeout)
  },
  getMimetype: function (name) {
    return {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      bmp: 'image/bmp',
      ogg: 'audio/ogg',
      wav: 'audio/wav',
      mp3: 'audio/mpeg'
    }[name.substr(name.lastIndexOf('.') + 1)]
  },
  getUserMedia: function (func) {
    if (!window.getUserMedia) {
      window.getUserMedia =
        navigator['getUserMedia'] || navigator['mozGetUserMedia']
    }
    window.getUserMedia(func)
  },
  getMovementX: function (event) {
    return (
      event['movementX'] ||
      event['mozMovementX'] ||
      event['webkitMovementX'] ||
      0
    )
  },
  getMovementY: function (event) {
    return (
      event['movementY'] ||
      event['mozMovementY'] ||
      event['webkitMovementY'] ||
      0
    )
  },
  getMouseWheelDelta: function (event) {
    var delta = 0
    switch (event.type) {
      case 'DOMMouseScroll':
        delta = event.detail / 3
        break
      case 'mousewheel':
        delta = event.wheelDelta / 120
        break
      case 'wheel':
        delta = event.deltaY
        switch (event.deltaMode) {
          case 0:
            delta /= 100
            break
          case 1:
            delta /= 3
            break
          case 2:
            delta *= 80
            break
          default:
            throw 'unrecognized mouse wheel delta mode: ' + event.deltaMode
        }
        break
      default:
        throw 'unrecognized mouse wheel event: ' + event.type
    }
    return delta
  },
  mouseX: 0,
  mouseY: 0,
  mouseMovementX: 0,
  mouseMovementY: 0,
  touches: {},
  lastTouches: {},
  calculateMouseEvent: function (event) {
    if (Browser.pointerLock) {
      if (event.type != 'mousemove' && 'mozMovementX' in event) {
        Browser.mouseMovementX = Browser.mouseMovementY = 0
      } else {
        Browser.mouseMovementX = Browser.getMovementX(event)
        Browser.mouseMovementY = Browser.getMovementY(event)
      }
      if (typeof SDL != 'undefined') {
        Browser.mouseX = SDL.mouseX + Browser.mouseMovementX
        Browser.mouseY = SDL.mouseY + Browser.mouseMovementY
      } else {
        Browser.mouseX += Browser.mouseMovementX
        Browser.mouseY += Browser.mouseMovementY
      }
    } else {
      var rect = Module['canvas'].getBoundingClientRect()
      var cw = Module['canvas'].width
      var ch = Module['canvas'].height
      var scrollX =
        typeof window.scrollX !== 'undefined'
          ? window.scrollX
          : window.pageXOffset
      var scrollY =
        typeof window.scrollY !== 'undefined'
          ? window.scrollY
          : window.pageYOffset
      if (
        event.type === 'touchstart' ||
        event.type === 'touchend' ||
        event.type === 'touchmove'
      ) {
        var touch = event.touch
        if (touch === undefined) {
          return
        }
        var adjustedX = touch.pageX - (scrollX + rect.left)
        var adjustedY = touch.pageY - (scrollY + rect.top)
        adjustedX = adjustedX * (cw / rect.width)
        adjustedY = adjustedY * (ch / rect.height)
        var coords = { x: adjustedX, y: adjustedY }
        if (event.type === 'touchstart') {
          Browser.lastTouches[touch.identifier] = coords
          Browser.touches[touch.identifier] = coords
        } else if (event.type === 'touchend' || event.type === 'touchmove') {
          var last = Browser.touches[touch.identifier]
          if (!last) last = coords
          Browser.lastTouches[touch.identifier] = last
          Browser.touches[touch.identifier] = coords
        }
        return
      }
      var x = event.pageX - (scrollX + rect.left)
      var y = event.pageY - (scrollY + rect.top)
      x = x * (cw / rect.width)
      y = y * (ch / rect.height)
      Browser.mouseMovementX = x - Browser.mouseX
      Browser.mouseMovementY = y - Browser.mouseY
      Browser.mouseX = x
      Browser.mouseY = y
    }
  },
  asyncLoad: function (url, onload, onerror, noRunDep) {
    var dep = !noRunDep ? getUniqueRunDependency('al ' + url) : ''
    readAsync(
      url,
      function (arrayBuffer) {
        assert(
          arrayBuffer,
          'Loading data file "' + url + '" failed (no arrayBuffer).'
        )
        onload(new Uint8Array(arrayBuffer))
        if (dep) removeRunDependency(dep)
      },
      function (event) {
        if (onerror) {
          onerror()
        } else {
          throw 'Loading data file "' + url + '" failed.'
        }
      }
    )
    if (dep) addRunDependency(dep)
  },
  resizeListeners: [],
  updateResizeListeners: function () {
    var canvas = Module['canvas']
    Browser.resizeListeners.forEach(function (listener) {
      listener(canvas.width, canvas.height)
    })
  },
  setCanvasSize: function (width, height, noUpdates) {
    var canvas = Module['canvas']
    Browser.updateCanvasDimensions(canvas, width, height)
    if (!noUpdates) Browser.updateResizeListeners()
  },
  windowedWidth: 0,
  windowedHeight: 0,
  setFullscreenCanvasSize: function () {
    if (typeof SDL != 'undefined') {
      var flags = HEAPU32[SDL.screen >> 2]
      flags = flags | 8388608
      HEAP32[SDL.screen >> 2] = flags
    }
    Browser.updateCanvasDimensions(Module['canvas'])
    Browser.updateResizeListeners()
  },
  setWindowedCanvasSize: function () {
    if (typeof SDL != 'undefined') {
      var flags = HEAPU32[SDL.screen >> 2]
      flags = flags & ~8388608
      HEAP32[SDL.screen >> 2] = flags
    }
    Browser.updateCanvasDimensions(Module['canvas'])
    Browser.updateResizeListeners()
  },
  updateCanvasDimensions: function (canvas, wNative, hNative) {
    if (wNative && hNative) {
      canvas.widthNative = wNative
      canvas.heightNative = hNative
    } else {
      wNative = canvas.widthNative
      hNative = canvas.heightNative
    }
    var w = wNative
    var h = hNative
    if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
      if (w / h < Module['forcedAspectRatio']) {
        w = Math.round(h * Module['forcedAspectRatio'])
      } else {
        h = Math.round(w / Module['forcedAspectRatio'])
      }
    }
    if (
      (document['fullscreenElement'] ||
        document['mozFullScreenElement'] ||
        document['msFullscreenElement'] ||
        document['webkitFullscreenElement'] ||
        document['webkitCurrentFullScreenElement']) === canvas.parentNode &&
      typeof screen != 'undefined'
    ) {
      var factor = Math.min(screen.width / w, screen.height / h)
      w = Math.round(w * factor)
      h = Math.round(h * factor)
    }
    if (Browser.resizeCanvas) {
      if (canvas.width != w) canvas.width = w
      if (canvas.height != h) canvas.height = h
      if (typeof canvas.style != 'undefined') {
        canvas.style.removeProperty('width')
        canvas.style.removeProperty('height')
      }
    } else {
      if (canvas.width != wNative) canvas.width = wNative
      if (canvas.height != hNative) canvas.height = hNative
      if (typeof canvas.style != 'undefined') {
        if (w != wNative || h != hNative) {
          canvas.style.setProperty('width', w + 'px', 'important')
          canvas.style.setProperty('height', h + 'px', 'important')
        } else {
          canvas.style.removeProperty('width')
          canvas.style.removeProperty('height')
        }
      }
    }
  },
  wgetRequests: {},
  nextWgetRequestHandle: 0,
  getNextWgetRequestHandle: function () {
    var handle = Browser.nextWgetRequestHandle
    Browser.nextWgetRequestHandle++
    return handle
  }
}
function __emscripten_push_uncounted_main_loop_blocker (func, arg, name) {
  Browser.mainLoop.queue.push({
    func: function () {
      dynCall_vi(func, arg)
    },
    name: UTF8ToString(name),
    counted: false
  })
  Browser.mainLoop.updateStatus()
}
function requireHandle (handle) {
  if (!handle) {
    throwBindingError('Cannot use deleted val. handle = ' + handle)
  }
  return emval_handle_array[handle].value
}
function getTypeName (type) {
  var ptr = ___getTypeName(type)
  var rv = readLatin1String(ptr)
  _free(ptr)
  return rv
}
function requireRegisteredType (rawType, humanName) {
  var impl = registeredTypes[rawType]
  if (undefined === impl) {
    throwBindingError(humanName + ' has unknown type ' + getTypeName(rawType))
  }
  return impl
}
function __emval_as (handle, returnType, destructorsRef) {
  handle = requireHandle(handle)
  returnType = requireRegisteredType(returnType, 'emval::as')
  var destructors = []
  var rd = __emval_register(destructors)
  HEAP32[destructorsRef >> 2] = rd
  return returnType['toWireType'](destructors, handle)
}
function __emval_lookupTypes (argCount, argTypes, argWireTypes) {
  var a = new Array(argCount)
  for (var i = 0; i < argCount; ++i) {
    a[i] = requireRegisteredType(HEAP32[(argTypes >> 2) + i], 'parameter ' + i)
  }
  return a
}
function __emval_call (handle, argCount, argTypes, argv) {
  handle = requireHandle(handle)
  var types = __emval_lookupTypes(argCount, argTypes)
  var args = new Array(argCount)
  for (var i = 0; i < argCount; ++i) {
    var type = types[i]
    args[i] = type['readValueFromPointer'](argv)
    argv += type['argPackAdvance']
  }
  var rv = handle.apply(undefined, args)
  return __emval_register(rv)
}
function __emval_allocateDestructors (destructorsRef) {
  var destructors = []
  HEAP32[destructorsRef >> 2] = __emval_register(destructors)
  return destructors
}
var emval_symbols = {}
function getStringOrSymbol (address) {
  var symbol = emval_symbols[address]
  if (symbol === undefined) {
    return readLatin1String(address)
  } else {
    return symbol
  }
}
var emval_methodCallers = []
function __emval_call_method (
  caller,
  handle,
  methodName,
  destructorsRef,
  args
) {
  caller = emval_methodCallers[caller]
  handle = requireHandle(handle)
  methodName = getStringOrSymbol(methodName)
  return caller(
    handle,
    methodName,
    __emval_allocateDestructors(destructorsRef),
    args
  )
}
function __emval_call_void_method (caller, handle, methodName, args) {
  caller = emval_methodCallers[caller]
  handle = requireHandle(handle)
  methodName = getStringOrSymbol(methodName)
  caller(handle, methodName, null, args)
}
function __emval_equals (first, second) {
  first = requireHandle(first)
  second = requireHandle(second)
  return first == second
}
function emval_get_global () {
  if (typeof globalThis === 'object') {
    return globalThis
  }
  return (function () {
    return Function
  })()('return this')()
}
function __emval_get_global (name) {
  if (name === 0) {
    return __emval_register(emval_get_global())
  } else {
    name = getStringOrSymbol(name)
    return __emval_register(emval_get_global()[name])
  }
}
function __emval_addMethodCaller (caller) {
  var id = emval_methodCallers.length
  emval_methodCallers.push(caller)
  return id
}
function new_ (constructor, argumentList) {
  if (!(constructor instanceof Function)) {
    throw new TypeError(
      'new_ called with constructor type ' +
        typeof constructor +
        ' which is not a function'
    )
  }
  var dummy = createNamedFunction(
    constructor.name || 'unknownFunctionName',
    function () {}
  )
  dummy.prototype = constructor.prototype
  var obj = new dummy()
  var r = constructor.apply(obj, argumentList)
  return r instanceof Object ? r : obj
}
function __emval_get_method_caller (argCount, argTypes) {
  var types = __emval_lookupTypes(argCount, argTypes)
  var retType = types[0]
  var signatureName =
    retType.name +
    '_$' +
    types
      .slice(1)
      .map(function (t) {
        return t.name
      })
      .join('_') +
    '$'
  var params = ['retType']
  var args = [retType]
  var argsList = ''
  for (var i = 0; i < argCount - 1; ++i) {
    argsList += (i !== 0 ? ', ' : '') + 'arg' + i
    params.push('argType' + i)
    args.push(types[1 + i])
  }
  var functionName = makeLegalFunctionName('methodCaller_' + signatureName)
  var functionBody =
    'return function ' + functionName + '(handle, name, destructors, args) {\n'
  var offset = 0
  for (var i = 0; i < argCount - 1; ++i) {
    functionBody +=
      '    var arg' +
      i +
      ' = argType' +
      i +
      '.readValueFromPointer(args' +
      (offset ? '+' + offset : '') +
      ');\n'
    offset += types[i + 1]['argPackAdvance']
  }
  functionBody += '    var rv = handle[name](' + argsList + ');\n'
  for (var i = 0; i < argCount - 1; ++i) {
    if (types[i + 1]['deleteObject']) {
      functionBody += '    argType' + i + '.deleteObject(arg' + i + ');\n'
    }
  }
  if (!retType.isVoid) {
    functionBody += '    return retType.toWireType(destructors, rv);\n'
  }
  functionBody += '};\n'
  params.push(functionBody)
  var invokerFunction = new_(Function, params).apply(null, args)
  return __emval_addMethodCaller(invokerFunction)
}
function __emval_get_property (handle, key) {
  handle = requireHandle(handle)
  key = requireHandle(key)
  return __emval_register(handle[key])
}
function __emval_incref (handle) {
  if (handle > 4) {
    emval_handle_array[handle].refcount += 1
  }
}
function __emval_new_cstring (v) {
  return __emval_register(getStringOrSymbol(v))
}
function runDestructors (destructors) {
  while (destructors.length) {
    var ptr = destructors.pop()
    var del = destructors.pop()
    del(ptr)
  }
}
function __emval_run_destructors (handle) {
  var destructors = emval_handle_array[handle].value
  runDestructors(destructors)
  __emval_decref(handle)
}
function __emval_set_property (handle, key, value) {
  handle = requireHandle(handle)
  key = requireHandle(key)
  value = requireHandle(value)
  handle[key] = value
}
function __emval_take_value (type, argv) {
  type = requireRegisteredType(type, '_emval_take_value')
  var v = type['readValueFromPointer'](argv)
  return __emval_register(v)
}
function _abort () {
  abort()
}
function _emscripten_get_now_is_monotonic () {
  return (
    0 ||
    ENVIRONMENT_IS_NODE ||
    typeof dateNow !== 'undefined' ||
    (typeof performance === 'object' &&
      performance &&
      typeof performance['now'] === 'function')
  )
}
function _clock_gettime (clk_id, tp) {
  var now
  if (clk_id === 0) {
    now = Date.now()
  } else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
    now = _emscripten_get_now()
  } else {
    ___setErrNo(22)
    return -1
  }
  HEAP32[tp >> 2] = (now / 1e3) | 0
  HEAP32[(tp + 4) >> 2] = ((now % 1e3) * 1e3 * 1e3) | 0
  return 0
}
function _emscripten_async_call (func, arg, millis) {
  noExitRuntime = true
  function wrapper () {
    getFuncWrapper(func, 'vi')(arg)
  }
  if (millis >= 0) {
    Browser.safeSetTimeout(wrapper, millis)
  } else {
    Browser.safeRequestAnimationFrame(wrapper)
  }
}
var JSEvents = {
  keyEvent: 0,
  mouseEvent: 0,
  wheelEvent: 0,
  uiEvent: 0,
  focusEvent: 0,
  deviceOrientationEvent: 0,
  deviceMotionEvent: 0,
  fullscreenChangeEvent: 0,
  pointerlockChangeEvent: 0,
  visibilityChangeEvent: 0,
  touchEvent: 0,
  previousFullscreenElement: null,
  previousScreenX: null,
  previousScreenY: null,
  removeEventListenersRegistered: false,
  removeAllEventListeners: function () {
    for (var i = JSEvents.eventHandlers.length - 1; i >= 0; --i) {
      JSEvents._removeHandler(i)
    }
    JSEvents.eventHandlers = []
    JSEvents.deferredCalls = []
  },
  registerRemoveEventListeners: function () {
    if (!JSEvents.removeEventListenersRegistered) {
      __ATEXIT__.push(JSEvents.removeAllEventListeners)
      JSEvents.removeEventListenersRegistered = true
    }
  },
  deferredCalls: [],
  deferCall: function (targetFunction, precedence, argsList) {
    function arraysHaveEqualContent (arrA, arrB) {
      if (arrA.length != arrB.length) return false
      for (var i in arrA) {
        if (arrA[i] != arrB[i]) return false
      }
      return true
    }
    for (var i in JSEvents.deferredCalls) {
      var call = JSEvents.deferredCalls[i]
      if (
        call.targetFunction == targetFunction &&
        arraysHaveEqualContent(call.argsList, argsList)
      ) {
        return
      }
    }
    JSEvents.deferredCalls.push({
      targetFunction: targetFunction,
      precedence: precedence,
      argsList: argsList
    })
    JSEvents.deferredCalls.sort(function (x, y) {
      return x.precedence < y.precedence
    })
  },
  removeDeferredCalls: function (targetFunction) {
    for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
      if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
        JSEvents.deferredCalls.splice(i, 1)
        --i
      }
    }
  },
  canPerformEventHandlerRequests: function () {
    return (
      JSEvents.inEventHandler &&
      JSEvents.currentEventHandler.allowsDeferredCalls
    )
  },
  runDeferredCalls: function () {
    if (!JSEvents.canPerformEventHandlerRequests()) {
      return
    }
    for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
      var call = JSEvents.deferredCalls[i]
      JSEvents.deferredCalls.splice(i, 1)
      --i
      call.targetFunction.apply(this, call.argsList)
    }
  },
  inEventHandler: 0,
  currentEventHandler: null,
  eventHandlers: [],
  isInternetExplorer: function () {
    return (
      navigator.userAgent.indexOf('MSIE') !== -1 ||
      navigator.appVersion.indexOf('Trident/') > 0
    )
  },
  removeAllHandlersOnTarget: function (target, eventTypeString) {
    for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
      if (
        JSEvents.eventHandlers[i].target == target &&
        (!eventTypeString ||
          eventTypeString == JSEvents.eventHandlers[i].eventTypeString)
      ) {
        JSEvents._removeHandler(i--)
      }
    }
  },
  _removeHandler: function (i) {
    var h = JSEvents.eventHandlers[i]
    h.target.removeEventListener(
      h.eventTypeString,
      h.eventListenerFunc,
      h.useCapture
    )
    JSEvents.eventHandlers.splice(i, 1)
  },
  registerOrRemoveHandler: function (eventHandler) {
    var jsEventHandler = function jsEventHandler (event) {
      ++JSEvents.inEventHandler
      JSEvents.currentEventHandler = eventHandler
      JSEvents.runDeferredCalls()
      eventHandler.handlerFunc(event)
      JSEvents.runDeferredCalls()
      --JSEvents.inEventHandler
    }
    if (eventHandler.callbackfunc) {
      eventHandler.eventListenerFunc = jsEventHandler
      eventHandler.target.addEventListener(
        eventHandler.eventTypeString,
        jsEventHandler,
        eventHandler.useCapture
      )
      JSEvents.eventHandlers.push(eventHandler)
      JSEvents.registerRemoveEventListeners()
    } else {
      for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
        if (
          JSEvents.eventHandlers[i].target == eventHandler.target &&
          JSEvents.eventHandlers[i].eventTypeString ==
            eventHandler.eventTypeString
        ) {
          JSEvents._removeHandler(i--)
        }
      }
    }
  },
  getBoundingClientRectOrZeros: function (target) {
    return target.getBoundingClientRect
      ? target.getBoundingClientRect()
      : { left: 0, top: 0 }
  },
  pageScrollPos: function () {
    if (pageXOffset > 0 || pageYOffset > 0) {
      return [pageXOffset, pageYOffset]
    }
    if (
      typeof document.documentElement.scrollLeft !== 'undefined' ||
      typeof document.documentElement.scrollTop !== 'undefined'
    ) {
      return [
        document.documentElement.scrollLeft,
        document.documentElement.scrollTop
      ]
    }
    return [document.body.scrollLeft | 0, document.body.scrollTop | 0]
  },
  getNodeNameForTarget: function (target) {
    if (!target) return ''
    if (target == window) return '#window'
    if (target == screen) return '#screen'
    return target && target.nodeName ? target.nodeName : ''
  },
  tick: function () {
    if (window['performance'] && window['performance']['now'])
      return window['performance']['now']()
    else return Date.now()
  },
  fullscreenEnabled: function () {
    return (
      document.fullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.msFullscreenEnabled
    )
  }
}
var __currentFullscreenStrategy = {}
var __specialEventTargets = [
  0,
  typeof document !== 'undefined' ? document : 0,
  typeof window !== 'undefined' ? window : 0
]
function __findEventTarget (target) {
  try {
    if (!target) return window
    if (typeof target === 'number')
      target = __specialEventTargets[target] || UTF8ToString(target)
    if (target === '#window') return window
    else if (target === '#document') return document
    else if (target === '#screen') return screen
    else if (target === '#canvas') return Module['canvas']
    return typeof target === 'string' ? document.getElementById(target) : target
  } catch (e) {
    return null
  }
}
function __findCanvasEventTarget (target) {
  if (typeof target === 'number') target = UTF8ToString(target)
  if (!target || target === '#canvas') {
    if (typeof GL !== 'undefined' && GL.offscreenCanvases['canvas'])
      return GL.offscreenCanvases['canvas']
    return Module['canvas']
  }
  if (typeof GL !== 'undefined' && GL.offscreenCanvases[target])
    return GL.offscreenCanvases[target]
  return __findEventTarget(target)
}
function _emscripten_get_canvas_element_size (target, width, height) {
  var canvas = __findCanvasEventTarget(target)
  if (!canvas) return -4
  HEAP32[width >> 2] = canvas.width
  HEAP32[height >> 2] = canvas.height
}
function __get_canvas_element_size (target) {
  var stackTop = stackSave()
  var w = stackAlloc(8)
  var h = w + 4
  var targetInt = stackAlloc(target.id.length + 1)
  stringToUTF8(target.id, targetInt, target.id.length + 1)
  var ret = _emscripten_get_canvas_element_size(targetInt, w, h)
  var size = [HEAP32[w >> 2], HEAP32[h >> 2]]
  stackRestore(stackTop)
  return size
}
function _emscripten_set_canvas_element_size (target, width, height) {
  var canvas = __findCanvasEventTarget(target)
  if (!canvas) return -4
  canvas.width = width
  canvas.height = height
  return 0
}
function __set_canvas_element_size (target, width, height) {
  if (!target.controlTransferredOffscreen) {
    target.width = width
    target.height = height
  } else {
    var stackTop = stackSave()
    var targetInt = stackAlloc(target.id.length + 1)
    stringToUTF8(target.id, targetInt, target.id.length + 1)
    _emscripten_set_canvas_element_size(targetInt, width, height)
    stackRestore(stackTop)
  }
}
function __registerRestoreOldStyle (canvas) {
  var canvasSize = __get_canvas_element_size(canvas)
  var oldWidth = canvasSize[0]
  var oldHeight = canvasSize[1]
  var oldCssWidth = canvas.style.width
  var oldCssHeight = canvas.style.height
  var oldBackgroundColor = canvas.style.backgroundColor
  var oldDocumentBackgroundColor = document.body.style.backgroundColor
  var oldPaddingLeft = canvas.style.paddingLeft
  var oldPaddingRight = canvas.style.paddingRight
  var oldPaddingTop = canvas.style.paddingTop
  var oldPaddingBottom = canvas.style.paddingBottom
  var oldMarginLeft = canvas.style.marginLeft
  var oldMarginRight = canvas.style.marginRight
  var oldMarginTop = canvas.style.marginTop
  var oldMarginBottom = canvas.style.marginBottom
  var oldDocumentBodyMargin = document.body.style.margin
  var oldDocumentOverflow = document.documentElement.style.overflow
  var oldDocumentScroll = document.body.scroll
  var oldImageRendering = canvas.style.imageRendering
  function restoreOldStyle () {
    var fullscreenElement =
      document.fullscreenElement ||
      document.mozFullScreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    if (!fullscreenElement) {
      document.removeEventListener('fullscreenchange', restoreOldStyle)
      document.removeEventListener('mozfullscreenchange', restoreOldStyle)
      document.removeEventListener('webkitfullscreenchange', restoreOldStyle)
      document.removeEventListener('MSFullscreenChange', restoreOldStyle)
      __set_canvas_element_size(canvas, oldWidth, oldHeight)
      canvas.style.width = oldCssWidth
      canvas.style.height = oldCssHeight
      canvas.style.backgroundColor = oldBackgroundColor
      if (!oldDocumentBackgroundColor)
        document.body.style.backgroundColor = 'white'
      document.body.style.backgroundColor = oldDocumentBackgroundColor
      canvas.style.paddingLeft = oldPaddingLeft
      canvas.style.paddingRight = oldPaddingRight
      canvas.style.paddingTop = oldPaddingTop
      canvas.style.paddingBottom = oldPaddingBottom
      canvas.style.marginLeft = oldMarginLeft
      canvas.style.marginRight = oldMarginRight
      canvas.style.marginTop = oldMarginTop
      canvas.style.marginBottom = oldMarginBottom
      document.body.style.margin = oldDocumentBodyMargin
      document.documentElement.style.overflow = oldDocumentOverflow
      document.body.scroll = oldDocumentScroll
      canvas.style.imageRendering = oldImageRendering
      if (canvas.GLctxObject)
        canvas.GLctxObject.GLctx.viewport(0, 0, oldWidth, oldHeight)
      if (__currentFullscreenStrategy.canvasResizedCallback) {
        dynCall_iiii(
          __currentFullscreenStrategy.canvasResizedCallback,
          37,
          0,
          __currentFullscreenStrategy.canvasResizedCallbackUserData
        )
      }
    }
  }
  document.addEventListener('fullscreenchange', restoreOldStyle)
  document.addEventListener('mozfullscreenchange', restoreOldStyle)
  document.addEventListener('webkitfullscreenchange', restoreOldStyle)
  document.addEventListener('MSFullscreenChange', restoreOldStyle)
  return restoreOldStyle
}
function __setLetterbox (element, topBottom, leftRight) {
  if (JSEvents.isInternetExplorer()) {
    element.style.marginLeft = element.style.marginRight = leftRight + 'px'
    element.style.marginTop = element.style.marginBottom = topBottom + 'px'
  } else {
    element.style.paddingLeft = element.style.paddingRight = leftRight + 'px'
    element.style.paddingTop = element.style.paddingBottom = topBottom + 'px'
  }
}
function _JSEvents_resizeCanvasForFullscreen (target, strategy) {
  var restoreOldStyle = __registerRestoreOldStyle(target)
  var cssWidth = strategy.softFullscreen ? innerWidth : screen.width
  var cssHeight = strategy.softFullscreen ? innerHeight : screen.height
  var rect = target.getBoundingClientRect()
  var windowedCssWidth = rect.right - rect.left
  var windowedCssHeight = rect.bottom - rect.top
  var canvasSize = __get_canvas_element_size(target)
  var windowedRttWidth = canvasSize[0]
  var windowedRttHeight = canvasSize[1]
  if (strategy.scaleMode == 3) {
    __setLetterbox(
      target,
      (cssHeight - windowedCssHeight) / 2,
      (cssWidth - windowedCssWidth) / 2
    )
    cssWidth = windowedCssWidth
    cssHeight = windowedCssHeight
  } else if (strategy.scaleMode == 2) {
    if (cssWidth * windowedRttHeight < windowedRttWidth * cssHeight) {
      var desiredCssHeight = (windowedRttHeight * cssWidth) / windowedRttWidth
      __setLetterbox(target, (cssHeight - desiredCssHeight) / 2, 0)
      cssHeight = desiredCssHeight
    } else {
      var desiredCssWidth = (windowedRttWidth * cssHeight) / windowedRttHeight
      __setLetterbox(target, 0, (cssWidth - desiredCssWidth) / 2)
      cssWidth = desiredCssWidth
    }
  }
  if (!target.style.backgroundColor) target.style.backgroundColor = 'black'
  if (!document.body.style.backgroundColor)
    document.body.style.backgroundColor = 'black'
  target.style.width = cssWidth + 'px'
  target.style.height = cssHeight + 'px'
  if (strategy.filteringMode == 1) {
    target.style.imageRendering = 'optimizeSpeed'
    target.style.imageRendering = '-moz-crisp-edges'
    target.style.imageRendering = '-o-crisp-edges'
    target.style.imageRendering = '-webkit-optimize-contrast'
    target.style.imageRendering = 'optimize-contrast'
    target.style.imageRendering = 'crisp-edges'
    target.style.imageRendering = 'pixelated'
  }
  var dpiScale = strategy.canvasResolutionScaleMode == 2 ? devicePixelRatio : 1
  if (strategy.canvasResolutionScaleMode != 0) {
    var newWidth = (cssWidth * dpiScale) | 0
    var newHeight = (cssHeight * dpiScale) | 0
    __set_canvas_element_size(target, newWidth, newHeight)
    if (target.GLctxObject)
      target.GLctxObject.GLctx.viewport(0, 0, newWidth, newHeight)
  }
  return restoreOldStyle
}
function _JSEvents_requestFullscreen (target, strategy) {
  if (strategy.scaleMode != 0 || strategy.canvasResolutionScaleMode != 0) {
    _JSEvents_resizeCanvasForFullscreen(target, strategy)
  }
  if (target.requestFullscreen) {
    target.requestFullscreen()
  } else if (target.msRequestFullscreen) {
    target.msRequestFullscreen()
  } else if (target.mozRequestFullScreen) {
    target.mozRequestFullScreen()
  } else if (target.mozRequestFullscreen) {
    target.mozRequestFullscreen()
  } else if (target.webkitRequestFullscreen) {
    target.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT)
  } else {
    return JSEvents.fullscreenEnabled() ? -3 : -1
  }
  if (strategy.canvasResizedCallback) {
    dynCall_iiii(
      strategy.canvasResizedCallback,
      37,
      0,
      strategy.canvasResizedCallbackUserData
    )
  }
  return 0
}
function _emscripten_exit_fullscreen () {
  if (!JSEvents.fullscreenEnabled()) return -1
  JSEvents.removeDeferredCalls(_JSEvents_requestFullscreen)
  var d = __specialEventTargets[1]
  if (d.exitFullscreen) {
    d.fullscreenElement && d.exitFullscreen()
  } else if (d.msExitFullscreen) {
    d.msFullscreenElement && d.msExitFullscreen()
  } else if (d.mozCancelFullScreen) {
    d.mozFullScreenElement && d.mozCancelFullScreen()
  } else if (d.webkitExitFullscreen) {
    d.webkitFullscreenElement && d.webkitExitFullscreen()
  } else {
    return -1
  }
  if (__currentFullscreenStrategy.canvasResizedCallback) {
    dynCall_iiii(
      __currentFullscreenStrategy.canvasResizedCallback,
      37,
      0,
      __currentFullscreenStrategy.canvasResizedCallbackUserData
    )
    __currentFullscreenStrategy = 0
  }
  return 0
}
function _emscripten_get_device_pixel_ratio () {
  return devicePixelRatio || 1
}
function _emscripten_get_element_css_size (target, width, height) {
  target = target ? __findEventTarget(target) : Module['canvas']
  if (!target) return -4
  if (target.getBoundingClientRect) {
    var rect = target.getBoundingClientRect()
    HEAPF64[width >> 3] = rect.right - rect.left
    HEAPF64[height >> 3] = rect.bottom - rect.top
  } else {
    HEAPF64[width >> 3] = target.clientWidth
    HEAPF64[height >> 3] = target.clientHeight
  }
  return 0
}
function __fillFullscreenChangeEventData (eventStruct, e) {
  var fullscreenElement =
    document.fullscreenElement ||
    document.mozFullScreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  var isFullscreen = !!fullscreenElement
  HEAP32[eventStruct >> 2] = isFullscreen
  HEAP32[(eventStruct + 4) >> 2] = JSEvents.fullscreenEnabled()
  var reportedElement = isFullscreen
    ? fullscreenElement
    : JSEvents.previousFullscreenElement
  var nodeName = JSEvents.getNodeNameForTarget(reportedElement)
  var id = reportedElement && reportedElement.id ? reportedElement.id : ''
  stringToUTF8(nodeName, eventStruct + 8, 128)
  stringToUTF8(id, eventStruct + 136, 128)
  HEAP32[(eventStruct + 264) >> 2] = reportedElement
    ? reportedElement.clientWidth
    : 0
  HEAP32[(eventStruct + 268) >> 2] = reportedElement
    ? reportedElement.clientHeight
    : 0
  HEAP32[(eventStruct + 272) >> 2] = screen.width
  HEAP32[(eventStruct + 276) >> 2] = screen.height
  if (isFullscreen) {
    JSEvents.previousFullscreenElement = fullscreenElement
  }
}
function _emscripten_get_fullscreen_status (fullscreenStatus) {
  if (!JSEvents.fullscreenEnabled()) return -1
  __fillFullscreenChangeEventData(fullscreenStatus)
  return 0
}
function _emscripten_get_heap_size () {
  return HEAP8.length
}
function _emscripten_get_mouse_status (mouseState) {
  if (!JSEvents.mouseEvent) return -7
  HEAP8.set(
    HEAP8.subarray(JSEvents.mouseEvent, JSEvents.mouseEvent + 72),
    mouseState
  )
  return 0
}
function _emscripten_get_sbrk_ptr () {
  return 780240
}
var setjmpId = 0
function _saveSetjmp (env, label, table, size) {
  env = env | 0
  label = label | 0
  table = table | 0
  size = size | 0
  var i = 0
  setjmpId = (setjmpId + 1) | 0
  HEAP32[env >> 2] = setjmpId
  while ((i | 0) < (size | 0)) {
    if ((HEAP32[(table + (i << 3)) >> 2] | 0) == 0) {
      HEAP32[(table + (i << 3)) >> 2] = setjmpId
      HEAP32[(table + ((i << 3) + 4)) >> 2] = label
      HEAP32[(table + ((i << 3) + 8)) >> 2] = 0
      setTempRet0(size | 0)
      return table | 0
    }
    i = (i + 1) | 0
  }
  size = (size * 2) | 0
  table = _realloc(table | 0, (8 * ((size + 1) | 0)) | 0) | 0
  table = _saveSetjmp(env | 0, label | 0, table | 0, size | 0) | 0
  setTempRet0(size | 0)
  return table | 0
}
function _testSetjmp (id, table, size) {
  id = id | 0
  table = table | 0
  size = size | 0
  var i = 0,
    curr = 0
  while ((i | 0) < (size | 0)) {
    curr = HEAP32[(table + (i << 3)) >> 2] | 0
    if ((curr | 0) == 0) break
    if ((curr | 0) == (id | 0)) {
      return HEAP32[(table + ((i << 3) + 4)) >> 2] | 0
    }
    i = (i + 1) | 0
  }
  return 0
}
function _longjmp (env, value) {
  _setThrew(env, value || 1)
  throw 'longjmp'
}
function _emscripten_longjmp (env, value) {
  _longjmp(env, value)
}
function _emscripten_memcpy_big (dest, src, num) {
  HEAPU8.set(HEAPU8.subarray(src, src + num), dest)
}
function __emscripten_do_request_fullscreen (target, strategy) {
  if (!JSEvents.fullscreenEnabled()) return -1
  if (!target) target = '#canvas'
  target = __findEventTarget(target)
  if (!target) return -4
  if (
    !target.requestFullscreen &&
    !target.msRequestFullscreen &&
    !target.mozRequestFullScreen &&
    !target.mozRequestFullscreen &&
    !target.webkitRequestFullscreen
  ) {
    return -3
  }
  var canPerformRequests = JSEvents.canPerformEventHandlerRequests()
  if (!canPerformRequests) {
    if (strategy.deferUntilInEventHandler) {
      JSEvents.deferCall(_JSEvents_requestFullscreen, 1, [target, strategy])
      return 1
    } else {
      return -2
    }
  }
  return _JSEvents_requestFullscreen(target, strategy)
}
function _emscripten_request_fullscreen_strategy (
  target,
  deferUntilInEventHandler,
  fullscreenStrategy
) {
  var strategy = {}
  strategy.scaleMode = HEAP32[fullscreenStrategy >> 2]
  strategy.canvasResolutionScaleMode = HEAP32[(fullscreenStrategy + 4) >> 2]
  strategy.filteringMode = HEAP32[(fullscreenStrategy + 8) >> 2]
  strategy.deferUntilInEventHandler = deferUntilInEventHandler
  strategy.canvasResizedCallback = HEAP32[(fullscreenStrategy + 12) >> 2]
  strategy.canvasResizedCallbackUserData =
    HEAP32[(fullscreenStrategy + 16) >> 2]
  __currentFullscreenStrategy = strategy
  return __emscripten_do_request_fullscreen(target, strategy)
}
function abortOnCannotGrowMemory (requestedSize) {
  abort('OOM')
}
function emscripten_realloc_buffer (size) {
  try {
    wasmMemory.grow((size - buffer.byteLength + 65535) >> 16)
    updateGlobalBufferAndViews(wasmMemory.buffer)
    return 1
  } catch (e) {}
}
function _emscripten_resize_heap (requestedSize) {
  var oldSize = _emscripten_get_heap_size()
  var PAGE_MULTIPLE = 65536
  var LIMIT = 2147483648 - PAGE_MULTIPLE
  if (requestedSize > LIMIT) {
    return false
  }
  var MIN_TOTAL_MEMORY = 16777216
  var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY)
  while (newSize < requestedSize) {
    if (newSize <= 536870912) {
      newSize = alignUp(2 * newSize, PAGE_MULTIPLE)
    } else {
      newSize = Math.min(
        alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE),
        LIMIT
      )
    }
  }
  var replacement = emscripten_realloc_buffer(newSize)
  if (!replacement) {
    return false
  }
  return true
}
function __fillMouseEventData (eventStruct, e, target) {
  HEAPF64[eventStruct >> 3] = JSEvents.tick()
  HEAP32[(eventStruct + 8) >> 2] = e.screenX
  HEAP32[(eventStruct + 12) >> 2] = e.screenY
  HEAP32[(eventStruct + 16) >> 2] = e.clientX
  HEAP32[(eventStruct + 20) >> 2] = e.clientY
  HEAP32[(eventStruct + 24) >> 2] = e.ctrlKey
  HEAP32[(eventStruct + 28) >> 2] = e.shiftKey
  HEAP32[(eventStruct + 32) >> 2] = e.altKey
  HEAP32[(eventStruct + 36) >> 2] = e.metaKey
  HEAP16[(eventStruct + 40) >> 1] = e.button
  HEAP16[(eventStruct + 42) >> 1] = e.buttons
  HEAP32[(eventStruct + 44) >> 2] =
    e['movementX'] ||
    e['mozMovementX'] ||
    e['webkitMovementX'] ||
    e.screenX - JSEvents.previousScreenX
  HEAP32[(eventStruct + 48) >> 2] =
    e['movementY'] ||
    e['mozMovementY'] ||
    e['webkitMovementY'] ||
    e.screenY - JSEvents.previousScreenY
  if (Module['canvas']) {
    var rect = Module['canvas'].getBoundingClientRect()
    HEAP32[(eventStruct + 60) >> 2] = e.clientX - rect.left
    HEAP32[(eventStruct + 64) >> 2] = e.clientY - rect.top
  } else {
    HEAP32[(eventStruct + 60) >> 2] = 0
    HEAP32[(eventStruct + 64) >> 2] = 0
  }
  if (target) {
    var rect = JSEvents.getBoundingClientRectOrZeros(target)
    HEAP32[(eventStruct + 52) >> 2] = e.clientX - rect.left
    HEAP32[(eventStruct + 56) >> 2] = e.clientY - rect.top
  } else {
    HEAP32[(eventStruct + 52) >> 2] = 0
    HEAP32[(eventStruct + 56) >> 2] = 0
  }
  if (e.type !== 'wheel' && e.type !== 'mousewheel') {
    JSEvents.previousScreenX = e.screenX
    JSEvents.previousScreenY = e.screenY
  }
}
function __registerMouseEventCallback (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) {
  if (!JSEvents.mouseEvent) JSEvents.mouseEvent = _malloc(72)
  target = __findEventTarget(target)
  var mouseEventHandlerFunc = function (ev) {
    var e = ev || event
    __fillMouseEventData(JSEvents.mouseEvent, e, target)
    if (dynCall_iiii(callbackfunc, eventTypeId, JSEvents.mouseEvent, userData))
      e.preventDefault()
  }
  var eventHandler = {
    target: target,
    allowsDeferredCalls:
      eventTypeString != 'mousemove' &&
      eventTypeString != 'mouseenter' &&
      eventTypeString != 'mouseleave',
    eventTypeString: eventTypeString,
    callbackfunc: callbackfunc,
    handlerFunc: mouseEventHandlerFunc,
    useCapture: useCapture
  }
  if (JSEvents.isInternetExplorer() && eventTypeString == 'mousedown')
    eventHandler.allowsDeferredCalls = false
  JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_click_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerMouseEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    4,
    'click',
    targetThread
  )
  return 0
}
function _emscripten_set_dblclick_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerMouseEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    7,
    'dblclick',
    targetThread
  )
  return 0
}
function __registerKeyEventCallback (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) {
  if (!JSEvents.keyEvent) JSEvents.keyEvent = _malloc(164)
  var keyEventHandlerFunc = function (ev) {
    var e = ev || event
    var keyEventData = JSEvents.keyEvent
    stringToUTF8(e.key ? e.key : '', keyEventData + 0, 32)
    stringToUTF8(e.code ? e.code : '', keyEventData + 32, 32)
    HEAP32[(keyEventData + 64) >> 2] = e.location
    HEAP32[(keyEventData + 68) >> 2] = e.ctrlKey
    HEAP32[(keyEventData + 72) >> 2] = e.shiftKey
    HEAP32[(keyEventData + 76) >> 2] = e.altKey
    HEAP32[(keyEventData + 80) >> 2] = e.metaKey
    HEAP32[(keyEventData + 84) >> 2] = e.repeat
    stringToUTF8(e.locale ? e.locale : '', keyEventData + 88, 32)
    stringToUTF8(e.char ? e.char : '', keyEventData + 120, 32)
    HEAP32[(keyEventData + 152) >> 2] = e.charCode
    HEAP32[(keyEventData + 156) >> 2] = e.keyCode
    HEAP32[(keyEventData + 160) >> 2] = e.which
    if (dynCall_iiii(callbackfunc, eventTypeId, keyEventData, userData))
      e.preventDefault()
  }
  var eventHandler = {
    target: __findEventTarget(target),
    allowsDeferredCalls: JSEvents.isInternetExplorer() ? false : true,
    eventTypeString: eventTypeString,
    callbackfunc: callbackfunc,
    handlerFunc: keyEventHandlerFunc,
    useCapture: useCapture
  }
  JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_keydown_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerKeyEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    2,
    'keydown',
    targetThread
  )
  return 0
}
function _emscripten_set_keyup_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerKeyEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    3,
    'keyup',
    targetThread
  )
  return 0
}
function _emscripten_set_mousedown_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerMouseEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    5,
    'mousedown',
    targetThread
  )
  return 0
}
function _emscripten_set_mouseleave_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerMouseEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    34,
    'mouseleave',
    targetThread
  )
  return 0
}
function _emscripten_set_mousemove_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerMouseEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    8,
    'mousemove',
    targetThread
  )
  return 0
}
function _emscripten_set_mouseup_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerMouseEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    6,
    'mouseup',
    targetThread
  )
  return 0
}
function __registerUiEventCallback (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) {
  if (!JSEvents.uiEvent) JSEvents.uiEvent = _malloc(36)
  if (eventTypeString == 'scroll' && !target) {
    target = document
  } else {
    target = __findEventTarget(target)
  }
  var uiEventHandlerFunc = function (ev) {
    var e = ev || event
    if (e.target != target) {
      return
    }
    var scrollPos = JSEvents.pageScrollPos()
    var uiEvent = JSEvents.uiEvent
    HEAP32[uiEvent >> 2] = e.detail
    HEAP32[(uiEvent + 4) >> 2] = document.body.clientWidth
    HEAP32[(uiEvent + 8) >> 2] = document.body.clientHeight
    HEAP32[(uiEvent + 12) >> 2] = innerWidth
    HEAP32[(uiEvent + 16) >> 2] = innerHeight
    HEAP32[(uiEvent + 20) >> 2] = outerWidth
    HEAP32[(uiEvent + 24) >> 2] = outerHeight
    HEAP32[(uiEvent + 28) >> 2] = scrollPos[0]
    HEAP32[(uiEvent + 32) >> 2] = scrollPos[1]
    if (dynCall_iiii(callbackfunc, eventTypeId, uiEvent, userData))
      e.preventDefault()
  }
  var eventHandler = {
    target: target,
    allowsDeferredCalls: false,
    eventTypeString: eventTypeString,
    callbackfunc: callbackfunc,
    handlerFunc: uiEventHandlerFunc,
    useCapture: useCapture
  }
  JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_resize_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerUiEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    10,
    'resize',
    targetThread
  )
  return 0
}
function __registerWebGlEventCallback (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) {
  if (!target) target = Module['canvas']
  var webGlEventHandlerFunc = function (ev) {
    var e = ev || event
    if (dynCall_iiii(callbackfunc, eventTypeId, 0, userData)) e.preventDefault()
  }
  var eventHandler = {
    target: __findEventTarget(target),
    allowsDeferredCalls: false,
    eventTypeString: eventTypeString,
    callbackfunc: callbackfunc,
    handlerFunc: webGlEventHandlerFunc,
    useCapture: useCapture
  }
  JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_webglcontextlost_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerWebGlEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    31,
    'webglcontextlost',
    targetThread
  )
  return 0
}
function _emscripten_set_webglcontextrestored_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  __registerWebGlEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    32,
    'webglcontextrestored',
    targetThread
  )
  return 0
}
function __registerWheelEventCallback (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) {
  if (!JSEvents.wheelEvent) JSEvents.wheelEvent = _malloc(104)
  var wheelHandlerFunc = function (ev) {
    var e = ev || event
    var wheelEvent = JSEvents.wheelEvent
    __fillMouseEventData(wheelEvent, e, target)
    HEAPF64[(wheelEvent + 72) >> 3] = e['deltaX']
    HEAPF64[(wheelEvent + 80) >> 3] = e['deltaY']
    HEAPF64[(wheelEvent + 88) >> 3] = e['deltaZ']
    HEAP32[(wheelEvent + 96) >> 2] = e['deltaMode']
    if (dynCall_iiii(callbackfunc, eventTypeId, wheelEvent, userData))
      e.preventDefault()
  }
  var mouseWheelHandlerFunc = function (ev) {
    var e = ev || event
    __fillMouseEventData(JSEvents.wheelEvent, e, target)
    HEAPF64[(JSEvents.wheelEvent + 72) >> 3] = e['wheelDeltaX'] || 0
    HEAPF64[(JSEvents.wheelEvent + 80) >> 3] = -(
      e['wheelDeltaY'] || e['wheelDelta']
    )
    HEAPF64[(JSEvents.wheelEvent + 88) >> 3] = 0
    HEAP32[(JSEvents.wheelEvent + 96) >> 2] = 0
    var shouldCancel = dynCall_iiii(
      callbackfunc,
      eventTypeId,
      JSEvents.wheelEvent,
      userData
    )
    if (shouldCancel) {
      e.preventDefault()
    }
  }
  var eventHandler = {
    target: target,
    allowsDeferredCalls: true,
    eventTypeString: eventTypeString,
    callbackfunc: callbackfunc,
    handlerFunc:
      eventTypeString == 'wheel' ? wheelHandlerFunc : mouseWheelHandlerFunc,
    useCapture: useCapture
  }
  JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_wheel_callback_on_thread (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) {
  target = __findEventTarget(target)
  if (typeof target.onwheel !== 'undefined') {
    __registerWheelEventCallback(
      target,
      userData,
      useCapture,
      callbackfunc,
      9,
      'wheel',
      targetThread
    )
    return 0
  } else if (typeof target.onmousewheel !== 'undefined') {
    __registerWheelEventCallback(
      target,
      userData,
      useCapture,
      callbackfunc,
      9,
      'mousewheel',
      targetThread
    )
    return 0
  } else {
    return -1
  }
}
var GL = {
  counter: 1,
  lastError: 0,
  buffers: [],
  mappedBuffers: {},
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  uniforms: [],
  shaders: [],
  vaos: [],
  contexts: {},
  currentContext: null,
  offscreenCanvases: {},
  timerQueriesEXT: [],
  programInfos: {},
  stringCache: {},
  unpackAlignment: 4,
  init: function () {
    GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE)
    for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
      GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i + 1)
    }
  },
  recordError: function recordError (errorCode) {
    if (!GL.lastError) {
      GL.lastError = errorCode
    }
  },
  getNewId: function (table) {
    var ret = GL.counter++
    for (var i = table.length; i < ret; i++) {
      table[i] = null
    }
    return ret
  },
  MINI_TEMP_BUFFER_SIZE: 256,
  miniTempBuffer: null,
  miniTempBufferViews: [0],
  getSource: function (shader, count, string, length) {
    var source = ''
    for (var i = 0; i < count; ++i) {
      var len = length ? HEAP32[(length + i * 4) >> 2] : -1
      source += UTF8ToString(
        HEAP32[(string + i * 4) >> 2],
        len < 0 ? undefined : len
      )
    }
    return source
  },
  createContext: function (canvas, webGLContextAttributes) {
    var ctx =
      canvas.getContext('webgl', webGLContextAttributes) ||
      canvas.getContext('experimental-webgl', webGLContextAttributes)
    if (!ctx) return 0
    var handle = GL.registerContext(ctx, webGLContextAttributes)
    return handle
  },
  registerContext: function (ctx, webGLContextAttributes) {
    var handle = _malloc(8)
    var context = {
      handle: handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes.majorVersion,
      GLctx: ctx
    }
    if (ctx.canvas) ctx.canvas.GLctxObject = context
    GL.contexts[handle] = context
    if (
      typeof webGLContextAttributes.enableExtensionsByDefault === 'undefined' ||
      webGLContextAttributes.enableExtensionsByDefault
    ) {
      GL.initExtensions(context)
    }
    return handle
  },
  makeContextCurrent: function (contextHandle) {
    GL.currentContext = GL.contexts[contextHandle]
    Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx
    return !(contextHandle && !GLctx)
  },
  getContext: function (contextHandle) {
    return GL.contexts[contextHandle]
  },
  deleteContext: function (contextHandle) {
    if (GL.currentContext === GL.contexts[contextHandle])
      GL.currentContext = null
    if (typeof JSEvents === 'object')
      JSEvents.removeAllHandlersOnTarget(
        GL.contexts[contextHandle].GLctx.canvas
      )
    if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas)
      GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined
    _free(GL.contexts[contextHandle])
    GL.contexts[contextHandle] = null
  },
  acquireInstancedArraysExtension: function (ctx) {
    var ext = ctx.getExtension('ANGLE_instanced_arrays')
    if (ext) {
      ctx['vertexAttribDivisor'] = function (index, divisor) {
        ext['vertexAttribDivisorANGLE'](index, divisor)
      }
      ctx['drawArraysInstanced'] = function (mode, first, count, primcount) {
        ext['drawArraysInstancedANGLE'](mode, first, count, primcount)
      }
      ctx['drawElementsInstanced'] = function (
        mode,
        count,
        type,
        indices,
        primcount
      ) {
        ext['drawElementsInstancedANGLE'](mode, count, type, indices, primcount)
      }
    }
  },
  acquireVertexArrayObjectExtension: function (ctx) {
    var ext = ctx.getExtension('OES_vertex_array_object')
    if (ext) {
      ctx['createVertexArray'] = function () {
        return ext['createVertexArrayOES']()
      }
      ctx['deleteVertexArray'] = function (vao) {
        ext['deleteVertexArrayOES'](vao)
      }
      ctx['bindVertexArray'] = function (vao) {
        ext['bindVertexArrayOES'](vao)
      }
      ctx['isVertexArray'] = function (vao) {
        return ext['isVertexArrayOES'](vao)
      }
    }
  },
  acquireDrawBuffersExtension: function (ctx) {
    var ext = ctx.getExtension('WEBGL_draw_buffers')
    if (ext) {
      ctx['drawBuffers'] = function (n, bufs) {
        ext['drawBuffersWEBGL'](n, bufs)
      }
    }
  },
  initExtensions: function (context) {
    if (!context) context = GL.currentContext
    if (context.initExtensionsDone) return
    context.initExtensionsDone = true
    var GLctx = context.GLctx
    if (context.version < 2) {
      GL.acquireInstancedArraysExtension(GLctx)
      GL.acquireVertexArrayObjectExtension(GLctx)
      GL.acquireDrawBuffersExtension(GLctx)
    }
    GLctx.disjointTimerQueryExt = GLctx.getExtension('EXT_disjoint_timer_query')
    var automaticallyEnabledExtensions = [
      'OES_texture_float',
      'OES_texture_half_float',
      'OES_standard_derivatives',
      'OES_vertex_array_object',
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_depth_texture',
      'OES_element_index_uint',
      'EXT_texture_filter_anisotropic',
      'EXT_frag_depth',
      'WEBGL_draw_buffers',
      'ANGLE_instanced_arrays',
      'OES_texture_float_linear',
      'OES_texture_half_float_linear',
      'EXT_blend_minmax',
      'EXT_shader_texture_lod',
      'WEBGL_compressed_texture_pvrtc',
      'EXT_color_buffer_half_float',
      'WEBGL_color_buffer_float',
      'EXT_sRGB',
      'WEBGL_compressed_texture_etc1',
      'EXT_disjoint_timer_query',
      'WEBGL_compressed_texture_etc',
      'WEBGL_compressed_texture_astc',
      'EXT_color_buffer_float',
      'WEBGL_compressed_texture_s3tc_srgb',
      'EXT_disjoint_timer_query_webgl2'
    ]
    var exts = GLctx.getSupportedExtensions() || []
    exts.forEach(function (ext) {
      if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
        GLctx.getExtension(ext)
      }
    })
  },
  populateUniformTable: function (program) {
    var p = GL.programs[program]
    var ptable = (GL.programInfos[program] = {
      uniforms: {},
      maxUniformLength: 0,
      maxAttributeLength: -1,
      maxUniformBlockNameLength: -1
    })
    var utable = ptable.uniforms
    var numUniforms = GLctx.getProgramParameter(p, 35718)
    for (var i = 0; i < numUniforms; ++i) {
      var u = GLctx.getActiveUniform(p, i)
      var name = u.name
      ptable.maxUniformLength = Math.max(
        ptable.maxUniformLength,
        name.length + 1
      )
      if (name.slice(-1) == ']') {
        name = name.slice(0, name.lastIndexOf('['))
      }
      var loc = GLctx.getUniformLocation(p, name)
      if (loc) {
        var id = GL.getNewId(GL.uniforms)
        utable[name] = [u.size, id]
        GL.uniforms[id] = loc
        for (var j = 1; j < u.size; ++j) {
          var n = name + '[' + j + ']'
          loc = GLctx.getUniformLocation(p, n)
          id = GL.getNewId(GL.uniforms)
          GL.uniforms[id] = loc
        }
      }
    }
  }
}
var __emscripten_webgl_power_preferences = [
  'default',
  'low-power',
  'high-performance'
]
function _emscripten_webgl_do_create_context (target, attributes) {
  var contextAttributes = {}
  var a = attributes >> 2
  contextAttributes['alpha'] = !!HEAP32[a + (0 >> 2)]
  contextAttributes['depth'] = !!HEAP32[a + (4 >> 2)]
  contextAttributes['stencil'] = !!HEAP32[a + (8 >> 2)]
  contextAttributes['antialias'] = !!HEAP32[a + (12 >> 2)]
  contextAttributes['premultipliedAlpha'] = !!HEAP32[a + (16 >> 2)]
  contextAttributes['preserveDrawingBuffer'] = !!HEAP32[a + (20 >> 2)]
  var powerPreference = HEAP32[a + (24 >> 2)]
  contextAttributes['powerPreference'] =
    __emscripten_webgl_power_preferences[powerPreference]
  contextAttributes['failIfMajorPerformanceCaveat'] = !!HEAP32[a + (28 >> 2)]
  contextAttributes.majorVersion = HEAP32[a + (32 >> 2)]
  contextAttributes.minorVersion = HEAP32[a + (36 >> 2)]
  contextAttributes.enableExtensionsByDefault = HEAP32[a + (40 >> 2)]
  contextAttributes.explicitSwapControl = HEAP32[a + (44 >> 2)]
  contextAttributes.proxyContextToMainThread = HEAP32[a + (48 >> 2)]
  contextAttributes.renderViaOffscreenBackBuffer = HEAP32[a + (52 >> 2)]
  var canvas = __findCanvasEventTarget(target)
  if (!canvas) {
    return 0
  }
  if (contextAttributes.explicitSwapControl) {
    return 0
  }
  var contextHandle = GL.createContext(canvas, contextAttributes)
  return contextHandle
}
function _emscripten_webgl_create_context (a0, a1) {
  return _emscripten_webgl_do_create_context(a0, a1)
}
function _emscripten_webgl_destroy_context_calling_thread (contextHandle) {
  if (GL.currentContext == contextHandle) GL.currentContext = 0
  GL.deleteContext(contextHandle)
}
function _emscripten_webgl_destroy_context (a0) {
  return _emscripten_webgl_destroy_context_calling_thread(a0)
}
function _emscripten_webgl_init_context_attributes (attributes) {
  var a = attributes >> 2
  for (var i = 0; i < 56 >> 2; ++i) {
    HEAP32[a + i] = 0
  }
  HEAP32[a + (0 >> 2)] = HEAP32[a + (4 >> 2)] = HEAP32[a + (12 >> 2)] = HEAP32[
    a + (16 >> 2)
  ] = HEAP32[a + (32 >> 2)] = HEAP32[a + (40 >> 2)] = 1
}
function _emscripten_webgl_make_context_current (contextHandle) {
  var success = GL.makeContextCurrent(contextHandle)
  return success ? 0 : -5
}
Module[
  '_emscripten_webgl_make_context_current'
] = _emscripten_webgl_make_context_current
function _emscripten_get_environ () {
  if (!_emscripten_get_environ.strings) {
    var ENV = {}
    ENV['USER'] = ENV['LOGNAME'] = 'web_user'
    ENV['PATH'] = '/'
    ENV['PWD'] = '/'
    ENV['HOME'] = '/home/web_user'
    ENV['LANG'] =
      (
        (typeof navigator === 'object' &&
          navigator.languages &&
          navigator.languages[0]) ||
        'C'
      ).replace('-', '_') + '.UTF-8'
    ENV['_'] = thisProgram
    var strings = []
    for (var key in ENV) {
      strings.push(key + '=' + ENV[key])
    }
    _emscripten_get_environ.strings = strings
  }
  return _emscripten_get_environ.strings
}
function _environ_get (__environ, environ_buf) {
  var strings = _emscripten_get_environ()
  var bufSize = 0
  strings.forEach(function (string, i) {
    var ptr = environ_buf + bufSize
    HEAP32[(__environ + i * 4) >> 2] = ptr
    writeAsciiToMemory(string, ptr)
    bufSize += string.length + 1
  })
  return 0
}
function _environ_sizes_get (environ_count, environ_buf_size) {
  var strings = _emscripten_get_environ()
  HEAP32[environ_count >> 2] = strings.length
  var bufSize = 0
  strings.forEach(function (string) {
    bufSize += string.length + 1
  })
  HEAP32[environ_buf_size >> 2] = bufSize
  return 0
}
function _exit (status) {
  exit(status)
}
function _fd_write (stream, iov, iovcnt, pnum) {
  try {
    stream = FS.getStream(stream)
    if (!stream) throw new FS.ErrnoError(9)
    var num = SYSCALLS.doWritev(stream, iov, iovcnt)
    HEAP32[pnum >> 2] = num
    return 0
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e)
    return -e.errno
  }
}
function _getTempRet0 () {
  return getTempRet0() | 0
}
function _glActiveTexture (x0) {
  GLctx['activeTexture'](x0)
}
function _glAttachShader (program, shader) {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader])
}
function _glBindAttribLocation (program, index, name) {
  GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name))
}
function _glBindBuffer (target, buffer) {
  GLctx.bindBuffer(target, GL.buffers[buffer])
}
function _glBindTexture (target, texture) {
  GLctx.bindTexture(target, GL.textures[texture])
}
function _glBlendFunc (x0, x1) {
  GLctx['blendFunc'](x0, x1)
}
function _glBufferData (target, size, data, usage) {
  GLctx.bufferData(
    target,
    data ? HEAPU8.subarray(data, data + size) : size,
    usage
  )
}
function _glClear (x0) {
  GLctx['clear'](x0)
}
function _glClearColor (x0, x1, x2, x3) {
  GLctx['clearColor'](x0, x1, x2, x3)
}
function _glClearDepthf (x0) {
  GLctx['clearDepth'](x0)
}
function _glColorMask (red, green, blue, alpha) {
  GLctx.colorMask(!!red, !!green, !!blue, !!alpha)
}
function _glCompileShader (shader) {
  GLctx.compileShader(GL.shaders[shader])
}
function _glCreateProgram () {
  var id = GL.getNewId(GL.programs)
  var program = GLctx.createProgram()
  program.name = id
  GL.programs[id] = program
  return id
}
function _glCreateShader (shaderType) {
  var id = GL.getNewId(GL.shaders)
  GL.shaders[id] = GLctx.createShader(shaderType)
  return id
}
function _glCullFace (x0) {
  GLctx['cullFace'](x0)
}
function _glDeleteBuffers (n, buffers) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(buffers + i * 4) >> 2]
    var buffer = GL.buffers[id]
    if (!buffer) continue
    GLctx.deleteBuffer(buffer)
    buffer.name = 0
    GL.buffers[id] = null
    if (id == GL.currArrayBuffer) GL.currArrayBuffer = 0
    if (id == GL.currElementArrayBuffer) GL.currElementArrayBuffer = 0
  }
}
function _glDeleteTextures (n, textures) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(textures + i * 4) >> 2]
    var texture = GL.textures[id]
    if (!texture) continue
    GLctx.deleteTexture(texture)
    texture.name = 0
    GL.textures[id] = null
  }
}
function _glDepthFunc (x0) {
  GLctx['depthFunc'](x0)
}
function _glDepthMask (flag) {
  GLctx.depthMask(!!flag)
}
function _glDepthRangef (x0, x1) {
  GLctx['depthRange'](x0, x1)
}
function _glDisable (x0) {
  GLctx['disable'](x0)
}
function _glDisableVertexAttribArray (index) {
  GLctx.disableVertexAttribArray(index)
}
function _glDrawArrays (mode, first, count) {
  GLctx.drawArrays(mode, first, count)
}
function _glDrawElements (mode, count, type, indices) {
  GLctx.drawElements(mode, count, type, indices)
}
function _glEnable (x0) {
  GLctx['enable'](x0)
}
function _glEnableVertexAttribArray (index) {
  GLctx.enableVertexAttribArray(index)
}
function _glFinish () {
  GLctx['finish']()
}
function _glFlush () {
  GLctx['flush']()
}
function _glFrontFace (x0) {
  GLctx['frontFace'](x0)
}
function __glGenObject (n, buffers, createFunction, objectTable) {
  for (var i = 0; i < n; i++) {
    var buffer = GLctx[createFunction]()
    var id = buffer && GL.getNewId(objectTable)
    if (buffer) {
      buffer.name = id
      objectTable[id] = buffer
    } else {
      GL.recordError(1282)
    }
    HEAP32[(buffers + i * 4) >> 2] = id
  }
}
function _glGenBuffers (n, buffers) {
  __glGenObject(n, buffers, 'createBuffer', GL.buffers)
}
function _glGenTextures (n, textures) {
  __glGenObject(n, textures, 'createTexture', GL.textures)
}
function _glGetError () {
  var error = GLctx.getError() || GL.lastError
  GL.lastError = 0
  return error
}
function emscriptenWebGLGet (name_, p, type) {
  if (!p) {
    GL.recordError(1281)
    return
  }
  var ret = undefined
  switch (name_) {
    case 36346:
      ret = 1
      break
    case 36344:
      if (type != 0 && type != 1) {
        GL.recordError(1280)
      }
      return
    case 36345:
      ret = 0
      break
    case 34466:
      var formats = GLctx.getParameter(34467)
      ret = formats ? formats.length : 0
      break
  }
  if (ret === undefined) {
    var result = GLctx.getParameter(name_)
    switch (typeof result) {
      case 'number':
        ret = result
        break
      case 'boolean':
        ret = result ? 1 : 0
        break
      case 'string':
        GL.recordError(1280)
        return
      case 'object':
        if (result === null) {
          switch (name_) {
            case 34964:
            case 35725:
            case 34965:
            case 36006:
            case 36007:
            case 32873:
            case 34229:
            case 34068: {
              ret = 0
              break
            }
            default: {
              GL.recordError(1280)
              return
            }
          }
        } else if (
          result instanceof Float32Array ||
          result instanceof Uint32Array ||
          result instanceof Int32Array ||
          result instanceof Array
        ) {
          for (var i = 0; i < result.length; ++i) {
            switch (type) {
              case 0:
                HEAP32[(p + i * 4) >> 2] = result[i]
                break
              case 2:
                HEAPF32[(p + i * 4) >> 2] = result[i]
                break
              case 4:
                HEAP8[(p + i) >> 0] = result[i] ? 1 : 0
                break
            }
          }
          return
        } else {
          try {
            ret = result.name | 0
          } catch (e) {
            GL.recordError(1280)
            err(
              'GL_INVALID_ENUM in glGet' +
                type +
                'v: Unknown object returned from WebGL getParameter(' +
                name_ +
                ')! (error: ' +
                e +
                ')'
            )
            return
          }
        }
        break
      default:
        GL.recordError(1280)
        err(
          'GL_INVALID_ENUM in glGet' +
            type +
            'v: Native code calling glGet' +
            type +
            'v(' +
            name_ +
            ') and it returns ' +
            result +
            ' of type ' +
            typeof result +
            '!'
        )
        return
    }
  }
  switch (type) {
    case 1:
      ;(tempI64 = [
        ret >>> 0,
        ((tempDouble = ret),
        +Math_abs(tempDouble) >= 1
          ? tempDouble > 0
            ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) |
                0) >>>
              0
            : ~~+Math_ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
              ) >>> 0
          : 0)
      ]),
        (HEAP32[p >> 2] = tempI64[0]),
        (HEAP32[(p + 4) >> 2] = tempI64[1])
      break
    case 0:
      HEAP32[p >> 2] = ret
      break
    case 2:
      HEAPF32[p >> 2] = ret
      break
    case 4:
      HEAP8[p >> 0] = ret ? 1 : 0
      break
  }
}
function _glGetIntegerv (name_, p) {
  emscriptenWebGLGet(name_, p, 0)
}
function _glGetProgramInfoLog (program, maxLength, length, infoLog) {
  var log = GLctx.getProgramInfoLog(GL.programs[program])
  if (log === null) log = '(unknown error)'
  var numBytesWrittenExclNull =
    maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull
}
function _glGetProgramiv (program, pname, p) {
  if (!p) {
    GL.recordError(1281)
    return
  }
  if (program >= GL.counter) {
    GL.recordError(1281)
    return
  }
  var ptable = GL.programInfos[program]
  if (!ptable) {
    GL.recordError(1282)
    return
  }
  if (pname == 35716) {
    var log = GLctx.getProgramInfoLog(GL.programs[program])
    if (log === null) log = '(unknown error)'
    HEAP32[p >> 2] = log.length + 1
  } else if (pname == 35719) {
    HEAP32[p >> 2] = ptable.maxUniformLength
  } else if (pname == 35722) {
    if (ptable.maxAttributeLength == -1) {
      program = GL.programs[program]
      var numAttribs = GLctx.getProgramParameter(program, 35721)
      ptable.maxAttributeLength = 0
      for (var i = 0; i < numAttribs; ++i) {
        var activeAttrib = GLctx.getActiveAttrib(program, i)
        ptable.maxAttributeLength = Math.max(
          ptable.maxAttributeLength,
          activeAttrib.name.length + 1
        )
      }
    }
    HEAP32[p >> 2] = ptable.maxAttributeLength
  } else if (pname == 35381) {
    if (ptable.maxUniformBlockNameLength == -1) {
      program = GL.programs[program]
      var numBlocks = GLctx.getProgramParameter(program, 35382)
      ptable.maxUniformBlockNameLength = 0
      for (var i = 0; i < numBlocks; ++i) {
        var activeBlockName = GLctx.getActiveUniformBlockName(program, i)
        ptable.maxUniformBlockNameLength = Math.max(
          ptable.maxUniformBlockNameLength,
          activeBlockName.length + 1
        )
      }
    }
    HEAP32[p >> 2] = ptable.maxUniformBlockNameLength
  } else {
    HEAP32[p >> 2] = GLctx.getProgramParameter(GL.programs[program], pname)
  }
}
function _glGetShaderInfoLog (shader, maxLength, length, infoLog) {
  var log = GLctx.getShaderInfoLog(GL.shaders[shader])
  if (log === null) log = '(unknown error)'
  var numBytesWrittenExclNull =
    maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull
}
function _glGetShaderiv (shader, pname, p) {
  if (!p) {
    GL.recordError(1281)
    return
  }
  if (pname == 35716) {
    var log = GLctx.getShaderInfoLog(GL.shaders[shader])
    if (log === null) log = '(unknown error)'
    HEAP32[p >> 2] = log.length + 1
  } else if (pname == 35720) {
    var source = GLctx.getShaderSource(GL.shaders[shader])
    var sourceLength =
      source === null || source.length == 0 ? 0 : source.length + 1
    HEAP32[p >> 2] = sourceLength
  } else {
    HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname)
  }
}
function stringToNewUTF8 (jsString) {
  var length = lengthBytesUTF8(jsString) + 1
  var cString = _malloc(length)
  stringToUTF8(jsString, cString, length)
  return cString
}
function _glGetString (name_) {
  if (GL.stringCache[name_]) return GL.stringCache[name_]
  var ret
  switch (name_) {
    case 7939:
      var exts = GLctx.getSupportedExtensions() || []
      exts = exts.concat(
        exts.map(function (e) {
          return 'GL_' + e
        })
      )
      ret = stringToNewUTF8(exts.join(' '))
      break
    case 7936:
    case 7937:
    case 37445:
    case 37446:
      var s = GLctx.getParameter(name_)
      if (!s) {
        GL.recordError(1280)
      }
      ret = stringToNewUTF8(s)
      break
    case 7938:
      var glVersion = GLctx.getParameter(GLctx.VERSION)
      {
        glVersion = 'OpenGL ES 2.0 (' + glVersion + ')'
      }
      ret = stringToNewUTF8(glVersion)
      break
    case 35724:
      var glslVersion = GLctx.getParameter(GLctx.SHADING_LANGUAGE_VERSION)
      var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/
      var ver_num = glslVersion.match(ver_re)
      if (ver_num !== null) {
        if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + '0'
        glslVersion =
          'OpenGL ES GLSL ES ' + ver_num[1] + ' (' + glslVersion + ')'
      }
      ret = stringToNewUTF8(glslVersion)
      break
    default:
      GL.recordError(1280)
      return 0
  }
  GL.stringCache[name_] = ret
  return ret
}
function _glGetUniformLocation (program, name) {
  name = UTF8ToString(name)
  var arrayIndex = 0
  if (name[name.length - 1] == ']') {
    var leftBrace = name.lastIndexOf('[')
    arrayIndex =
      name[leftBrace + 1] != ']' ? parseInt(name.slice(leftBrace + 1)) : 0
    name = name.slice(0, leftBrace)
  }
  var uniformInfo =
    GL.programInfos[program] && GL.programInfos[program].uniforms[name]
  if (uniformInfo && arrayIndex >= 0 && arrayIndex < uniformInfo[0]) {
    return uniformInfo[1] + arrayIndex
  } else {
    return -1
  }
}
function _glLinkProgram (program) {
  GLctx.linkProgram(GL.programs[program])
  GL.populateUniformTable(program)
}
function __computeUnpackAlignedImageSize (
  width,
  height,
  sizePerPixel,
  alignment
) {
  function roundedToNextMultipleOf (x, y) {
    return (x + y - 1) & -y
  }
  var plainRowSize = width * sizePerPixel
  var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment)
  return height * alignedRowSize
}
var __colorChannelsInGlTextureFormat = {
  6402: 1,
  6406: 1,
  6407: 3,
  6408: 4,
  6409: 1,
  6410: 2,
  35904: 3,
  35906: 4
}
var __sizeOfGlTextureElementType = {
  5121: 1,
  5123: 2,
  5125: 4,
  5126: 4,
  32819: 2,
  32820: 2,
  33635: 2,
  34042: 4,
  36193: 2
}
function emscriptenWebGLGetTexPixelData (
  type,
  format,
  width,
  height,
  pixels,
  internalFormat
) {
  var sizePerPixel =
    __colorChannelsInGlTextureFormat[format] *
    __sizeOfGlTextureElementType[type]
  if (!sizePerPixel) {
    GL.recordError(1280)
    return
  }
  var bytes = __computeUnpackAlignedImageSize(
    width,
    height,
    sizePerPixel,
    GL.unpackAlignment
  )
  var end = pixels + bytes
  switch (type) {
    case 5121:
      return HEAPU8.subarray(pixels, end)
    case 5126:
      return HEAPF32.subarray(pixels >> 2, end >> 2)
    case 5125:
    case 34042:
      return HEAPU32.subarray(pixels >> 2, end >> 2)
    case 5123:
    case 33635:
    case 32819:
    case 32820:
    case 36193:
      return HEAPU16.subarray(pixels >> 1, end >> 1)
    default:
      GL.recordError(1280)
  }
}
function _glReadPixels (x, y, width, height, format, type, pixels) {
  var pixelData = emscriptenWebGLGetTexPixelData(
    type,
    format,
    width,
    height,
    pixels,
    format
  )
  if (!pixelData) {
    GL.recordError(1280)
    return
  }
  GLctx.readPixels(x, y, width, height, format, type, pixelData)
}
function _glShaderSource (shader, count, string, length) {
  var source = GL.getSource(shader, count, string, length)
  GLctx.shaderSource(GL.shaders[shader], source)
}
function _glTexImage2D (
  target,
  level,
  internalFormat,
  width,
  height,
  border,
  format,
  type,
  pixels
) {
  GLctx.texImage2D(
    target,
    level,
    internalFormat,
    width,
    height,
    border,
    format,
    type,
    pixels
      ? emscriptenWebGLGetTexPixelData(
          type,
          format,
          width,
          height,
          pixels,
          internalFormat
        )
      : null
  )
}
function _glTexParameteri (x0, x1, x2) {
  GLctx['texParameteri'](x0, x1, x2)
}
function _glUniform1f (location, v0) {
  GLctx.uniform1f(GL.uniforms[location], v0)
}
function _glUniform1i (location, v0) {
  GLctx.uniform1i(GL.uniforms[location], v0)
}
function _glUniform3f (location, v0, v1, v2) {
  GLctx.uniform3f(GL.uniforms[location], v0, v1, v2)
}
function _glUniform4f (location, v0, v1, v2, v3) {
  GLctx.uniform4f(GL.uniforms[location], v0, v1, v2, v3)
}
function _glUniformMatrix4fv (location, count, transpose, value) {
  if (16 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    var view = GL.miniTempBufferViews[16 * count - 1]
    for (var i = 0; i < 16 * count; i += 16) {
      view[i] = HEAPF32[(value + 4 * i) >> 2]
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2]
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2]
      view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2]
      view[i + 4] = HEAPF32[(value + (4 * i + 16)) >> 2]
      view[i + 5] = HEAPF32[(value + (4 * i + 20)) >> 2]
      view[i + 6] = HEAPF32[(value + (4 * i + 24)) >> 2]
      view[i + 7] = HEAPF32[(value + (4 * i + 28)) >> 2]
      view[i + 8] = HEAPF32[(value + (4 * i + 32)) >> 2]
      view[i + 9] = HEAPF32[(value + (4 * i + 36)) >> 2]
      view[i + 10] = HEAPF32[(value + (4 * i + 40)) >> 2]
      view[i + 11] = HEAPF32[(value + (4 * i + 44)) >> 2]
      view[i + 12] = HEAPF32[(value + (4 * i + 48)) >> 2]
      view[i + 13] = HEAPF32[(value + (4 * i + 52)) >> 2]
      view[i + 14] = HEAPF32[(value + (4 * i + 56)) >> 2]
      view[i + 15] = HEAPF32[(value + (4 * i + 60)) >> 2]
    }
  } else {
    var view = HEAPF32.subarray(value >> 2, (value + count * 64) >> 2)
  }
  GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, view)
}
function _glUseProgram (program) {
  GLctx.useProgram(GL.programs[program])
}
function _glVertexAttrib4f (x0, x1, x2, x3, x4) {
  GLctx['vertexAttrib4f'](x0, x1, x2, x3, x4)
}
function _glVertexAttribPointer (index, size, type, normalized, stride, ptr) {
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr)
}
function _glViewport (x0, x1, x2, x3) {
  GLctx['viewport'](x0, x1, x2, x3)
}
function _memcpy (dest, src, num) {
  dest = dest | 0
  src = src | 0
  num = num | 0
  var ret = 0
  var aligned_dest_end = 0
  var block_aligned_dest_end = 0
  var dest_end = 0
  if ((num | 0) >= 8192) {
    _emscripten_memcpy_big(dest | 0, src | 0, num | 0) | 0
    return dest | 0
  }
  ret = dest | 0
  dest_end = (dest + num) | 0
  if ((dest & 3) == (src & 3)) {
    while (dest & 3) {
      if ((num | 0) == 0) return ret | 0
      HEAP8[dest >> 0] = HEAP8[src >> 0] | 0
      dest = (dest + 1) | 0
      src = (src + 1) | 0
      num = (num - 1) | 0
    }
    aligned_dest_end = (dest_end & -4) | 0
    block_aligned_dest_end = (aligned_dest_end - 64) | 0
    while ((dest | 0) <= (block_aligned_dest_end | 0)) {
      HEAP32[dest >> 2] = HEAP32[src >> 2] | 0
      HEAP32[(dest + 4) >> 2] = HEAP32[(src + 4) >> 2] | 0
      HEAP32[(dest + 8) >> 2] = HEAP32[(src + 8) >> 2] | 0
      HEAP32[(dest + 12) >> 2] = HEAP32[(src + 12) >> 2] | 0
      HEAP32[(dest + 16) >> 2] = HEAP32[(src + 16) >> 2] | 0
      HEAP32[(dest + 20) >> 2] = HEAP32[(src + 20) >> 2] | 0
      HEAP32[(dest + 24) >> 2] = HEAP32[(src + 24) >> 2] | 0
      HEAP32[(dest + 28) >> 2] = HEAP32[(src + 28) >> 2] | 0
      HEAP32[(dest + 32) >> 2] = HEAP32[(src + 32) >> 2] | 0
      HEAP32[(dest + 36) >> 2] = HEAP32[(src + 36) >> 2] | 0
      HEAP32[(dest + 40) >> 2] = HEAP32[(src + 40) >> 2] | 0
      HEAP32[(dest + 44) >> 2] = HEAP32[(src + 44) >> 2] | 0
      HEAP32[(dest + 48) >> 2] = HEAP32[(src + 48) >> 2] | 0
      HEAP32[(dest + 52) >> 2] = HEAP32[(src + 52) >> 2] | 0
      HEAP32[(dest + 56) >> 2] = HEAP32[(src + 56) >> 2] | 0
      HEAP32[(dest + 60) >> 2] = HEAP32[(src + 60) >> 2] | 0
      dest = (dest + 64) | 0
      src = (src + 64) | 0
    }
    while ((dest | 0) < (aligned_dest_end | 0)) {
      HEAP32[dest >> 2] = HEAP32[src >> 2] | 0
      dest = (dest + 4) | 0
      src = (src + 4) | 0
    }
  } else {
    aligned_dest_end = (dest_end - 4) | 0
    while ((dest | 0) < (aligned_dest_end | 0)) {
      HEAP8[dest >> 0] = HEAP8[src >> 0] | 0
      HEAP8[(dest + 1) >> 0] = HEAP8[(src + 1) >> 0] | 0
      HEAP8[(dest + 2) >> 0] = HEAP8[(src + 2) >> 0] | 0
      HEAP8[(dest + 3) >> 0] = HEAP8[(src + 3) >> 0] | 0
      dest = (dest + 4) | 0
      src = (src + 4) | 0
    }
  }
  while ((dest | 0) < (dest_end | 0)) {
    HEAP8[dest >> 0] = HEAP8[src >> 0] | 0
    dest = (dest + 1) | 0
    src = (src + 1) | 0
  }
  return ret | 0
}
function _memset (ptr, value, num) {
  ptr = ptr | 0
  value = value | 0
  num = num | 0
  var end = 0,
    aligned_end = 0,
    block_aligned_end = 0,
    value4 = 0
  end = (ptr + num) | 0
  value = value & 255
  if ((num | 0) >= 67) {
    while ((ptr & 3) != 0) {
      HEAP8[ptr >> 0] = value
      ptr = (ptr + 1) | 0
    }
    aligned_end = (end & -4) | 0
    value4 = value | (value << 8) | (value << 16) | (value << 24)
    block_aligned_end = (aligned_end - 64) | 0
    while ((ptr | 0) <= (block_aligned_end | 0)) {
      HEAP32[ptr >> 2] = value4
      HEAP32[(ptr + 4) >> 2] = value4
      HEAP32[(ptr + 8) >> 2] = value4
      HEAP32[(ptr + 12) >> 2] = value4
      HEAP32[(ptr + 16) >> 2] = value4
      HEAP32[(ptr + 20) >> 2] = value4
      HEAP32[(ptr + 24) >> 2] = value4
      HEAP32[(ptr + 28) >> 2] = value4
      HEAP32[(ptr + 32) >> 2] = value4
      HEAP32[(ptr + 36) >> 2] = value4
      HEAP32[(ptr + 40) >> 2] = value4
      HEAP32[(ptr + 44) >> 2] = value4
      HEAP32[(ptr + 48) >> 2] = value4
      HEAP32[(ptr + 52) >> 2] = value4
      HEAP32[(ptr + 56) >> 2] = value4
      HEAP32[(ptr + 60) >> 2] = value4
      ptr = (ptr + 64) | 0
    }
    while ((ptr | 0) < (aligned_end | 0)) {
      HEAP32[ptr >> 2] = value4
      ptr = (ptr + 4) | 0
    }
  }
  while ((ptr | 0) < (end | 0)) {
    HEAP8[ptr >> 0] = value
    ptr = (ptr + 1) | 0
  }
  return (end - num) | 0
}
function _setTempRet0 ($i) {
  setTempRet0($i | 0)
}
function __isLeapYear (year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}
function __arraySum (array, index) {
  var sum = 0
  for (var i = 0; i <= index; sum += array[i++]);
  return sum
}
var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
function __addDays (date, days) {
  var newDate = new Date(date.getTime())
  while (days > 0) {
    var leap = __isLeapYear(newDate.getFullYear())
    var currentMonth = newDate.getMonth()
    var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[
      currentMonth
    ]
    if (days > daysInCurrentMonth - newDate.getDate()) {
      days -= daysInCurrentMonth - newDate.getDate() + 1
      newDate.setDate(1)
      if (currentMonth < 11) {
        newDate.setMonth(currentMonth + 1)
      } else {
        newDate.setMonth(0)
        newDate.setFullYear(newDate.getFullYear() + 1)
      }
    } else {
      newDate.setDate(newDate.getDate() + days)
      return newDate
    }
  }
  return newDate
}
function _strftime (s, maxsize, format, tm) {
  var tm_zone = HEAP32[(tm + 40) >> 2]
  var date = {
    tm_sec: HEAP32[tm >> 2],
    tm_min: HEAP32[(tm + 4) >> 2],
    tm_hour: HEAP32[(tm + 8) >> 2],
    tm_mday: HEAP32[(tm + 12) >> 2],
    tm_mon: HEAP32[(tm + 16) >> 2],
    tm_year: HEAP32[(tm + 20) >> 2],
    tm_wday: HEAP32[(tm + 24) >> 2],
    tm_yday: HEAP32[(tm + 28) >> 2],
    tm_isdst: HEAP32[(tm + 32) >> 2],
    tm_gmtoff: HEAP32[(tm + 36) >> 2],
    tm_zone: tm_zone ? UTF8ToString(tm_zone) : ''
  }
  var pattern = UTF8ToString(format)
  var EXPANSION_RULES_1 = {
    '%c': '%a %b %d %H:%M:%S %Y',
    '%D': '%m/%d/%y',
    '%F': '%Y-%m-%d',
    '%h': '%b',
    '%r': '%I:%M:%S %p',
    '%R': '%H:%M',
    '%T': '%H:%M:%S',
    '%x': '%m/%d/%y',
    '%X': '%H:%M:%S',
    '%Ec': '%c',
    '%EC': '%C',
    '%Ex': '%m/%d/%y',
    '%EX': '%H:%M:%S',
    '%Ey': '%y',
    '%EY': '%Y',
    '%Od': '%d',
    '%Oe': '%e',
    '%OH': '%H',
    '%OI': '%I',
    '%Om': '%m',
    '%OM': '%M',
    '%OS': '%S',
    '%Ou': '%u',
    '%OU': '%U',
    '%OV': '%V',
    '%Ow': '%w',
    '%OW': '%W',
    '%Oy': '%y'
  }
  for (var rule in EXPANSION_RULES_1) {
    pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule])
  }
  var WEEKDAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ]
  var MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ]
  function leadingSomething (value, digits, character) {
    var str = typeof value === 'number' ? value.toString() : value || ''
    while (str.length < digits) {
      str = character[0] + str
    }
    return str
  }
  function leadingNulls (value, digits) {
    return leadingSomething(value, digits, '0')
  }
  function compareByDay (date1, date2) {
    function sgn (value) {
      return value < 0 ? -1 : value > 0 ? 1 : 0
    }
    var compare
    if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
      if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
        compare = sgn(date1.getDate() - date2.getDate())
      }
    }
    return compare
  }
  function getFirstWeekStartDate (janFourth) {
    switch (janFourth.getDay()) {
      case 0:
        return new Date(janFourth.getFullYear() - 1, 11, 29)
      case 1:
        return janFourth
      case 2:
        return new Date(janFourth.getFullYear(), 0, 3)
      case 3:
        return new Date(janFourth.getFullYear(), 0, 2)
      case 4:
        return new Date(janFourth.getFullYear(), 0, 1)
      case 5:
        return new Date(janFourth.getFullYear() - 1, 11, 31)
      case 6:
        return new Date(janFourth.getFullYear() - 1, 11, 30)
    }
  }
  function getWeekBasedYear (date) {
    var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday)
    var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4)
    var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4)
    var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear)
    var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear)
    if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
      if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
        return thisDate.getFullYear() + 1
      } else {
        return thisDate.getFullYear()
      }
    } else {
      return thisDate.getFullYear() - 1
    }
  }
  var EXPANSION_RULES_2 = {
    '%a': function (date) {
      return WEEKDAYS[date.tm_wday].substring(0, 3)
    },
    '%A': function (date) {
      return WEEKDAYS[date.tm_wday]
    },
    '%b': function (date) {
      return MONTHS[date.tm_mon].substring(0, 3)
    },
    '%B': function (date) {
      return MONTHS[date.tm_mon]
    },
    '%C': function (date) {
      var year = date.tm_year + 1900
      return leadingNulls((year / 100) | 0, 2)
    },
    '%d': function (date) {
      return leadingNulls(date.tm_mday, 2)
    },
    '%e': function (date) {
      return leadingSomething(date.tm_mday, 2, ' ')
    },
    '%g': function (date) {
      return getWeekBasedYear(date)
        .toString()
        .substring(2)
    },
    '%G': function (date) {
      return getWeekBasedYear(date)
    },
    '%H': function (date) {
      return leadingNulls(date.tm_hour, 2)
    },
    '%I': function (date) {
      var twelveHour = date.tm_hour
      if (twelveHour == 0) twelveHour = 12
      else if (twelveHour > 12) twelveHour -= 12
      return leadingNulls(twelveHour, 2)
    },
    '%j': function (date) {
      return leadingNulls(
        date.tm_mday +
          __arraySum(
            __isLeapYear(date.tm_year + 1900)
              ? __MONTH_DAYS_LEAP
              : __MONTH_DAYS_REGULAR,
            date.tm_mon - 1
          ),
        3
      )
    },
    '%m': function (date) {
      return leadingNulls(date.tm_mon + 1, 2)
    },
    '%M': function (date) {
      return leadingNulls(date.tm_min, 2)
    },
    '%n': function () {
      return '\n'
    },
    '%p': function (date) {
      if (date.tm_hour >= 0 && date.tm_hour < 12) {
        return 'AM'
      } else {
        return 'PM'
      }
    },
    '%S': function (date) {
      return leadingNulls(date.tm_sec, 2)
    },
    '%t': function () {
      return '\t'
    },
    '%u': function (date) {
      return date.tm_wday || 7
    },
    '%U': function (date) {
      var janFirst = new Date(date.tm_year + 1900, 0, 1)
      var firstSunday =
        janFirst.getDay() === 0
          ? janFirst
          : __addDays(janFirst, 7 - janFirst.getDay())
      var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday)
      if (compareByDay(firstSunday, endDate) < 0) {
        var februaryFirstUntilEndMonth =
          __arraySum(
            __isLeapYear(endDate.getFullYear())
              ? __MONTH_DAYS_LEAP
              : __MONTH_DAYS_REGULAR,
            endDate.getMonth() - 1
          ) - 31
        var firstSundayUntilEndJanuary = 31 - firstSunday.getDate()
        var days =
          firstSundayUntilEndJanuary +
          februaryFirstUntilEndMonth +
          endDate.getDate()
        return leadingNulls(Math.ceil(days / 7), 2)
      }
      return compareByDay(firstSunday, janFirst) === 0 ? '01' : '00'
    },
    '%V': function (date) {
      var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4)
      var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4)
      var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear)
      var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear)
      var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday)
      if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
        return '53'
      }
      if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
        return '01'
      }
      var daysDifference
      if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
        daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate()
      } else {
        daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate()
      }
      return leadingNulls(Math.ceil(daysDifference / 7), 2)
    },
    '%w': function (date) {
      return date.tm_wday
    },
    '%W': function (date) {
      var janFirst = new Date(date.tm_year, 0, 1)
      var firstMonday =
        janFirst.getDay() === 1
          ? janFirst
          : __addDays(
              janFirst,
              janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1
            )
      var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday)
      if (compareByDay(firstMonday, endDate) < 0) {
        var februaryFirstUntilEndMonth =
          __arraySum(
            __isLeapYear(endDate.getFullYear())
              ? __MONTH_DAYS_LEAP
              : __MONTH_DAYS_REGULAR,
            endDate.getMonth() - 1
          ) - 31
        var firstMondayUntilEndJanuary = 31 - firstMonday.getDate()
        var days =
          firstMondayUntilEndJanuary +
          februaryFirstUntilEndMonth +
          endDate.getDate()
        return leadingNulls(Math.ceil(days / 7), 2)
      }
      return compareByDay(firstMonday, janFirst) === 0 ? '01' : '00'
    },
    '%y': function (date) {
      return (date.tm_year + 1900).toString().substring(2)
    },
    '%Y': function (date) {
      return date.tm_year + 1900
    },
    '%z': function (date) {
      var off = date.tm_gmtoff
      var ahead = off >= 0
      off = Math.abs(off) / 60
      off = (off / 60) * 100 + (off % 60)
      return (ahead ? '+' : '-') + String('0000' + off).slice(-4)
    },
    '%Z': function (date) {
      return date.tm_zone
    },
    '%%': function () {
      return '%'
    }
  }
  for (var rule in EXPANSION_RULES_2) {
    if (pattern.indexOf(rule) >= 0) {
      pattern = pattern.replace(
        new RegExp(rule, 'g'),
        EXPANSION_RULES_2[rule](date)
      )
    }
  }
  var bytes = intArrayFromString(pattern, false)
  if (bytes.length > maxsize) {
    return 0
  }
  writeArrayToMemory(bytes, s)
  return bytes.length - 1
}
function _strftime_l (s, maxsize, format, tm) {
  return _strftime(s, maxsize, format, tm)
}
FS.staticInit()
Module['FS_createFolder'] = FS.createFolder
Module['FS_createPath'] = FS.createPath
Module['FS_createDataFile'] = FS.createDataFile
Module['FS_createPreloadedFile'] = FS.createPreloadedFile
Module['FS_createLazyFile'] = FS.createLazyFile
Module['FS_createLink'] = FS.createLink
Module['FS_createDevice'] = FS.createDevice
Module['FS_unlink'] = FS.unlink
if (ENVIRONMENT_HAS_NODE) {
  var fs = require('fs')
  var NODEJS_PATH = require('path')
  NODEFS.staticInit()
}
embind_init_charCodes()
BindingError = Module['BindingError'] = extendError(Error, 'BindingError')
InternalError = Module['InternalError'] = extendError(Error, 'InternalError')
init_emval()
Module['requestFullScreen'] = function Module_requestFullScreen (
  lockPointer,
  resizeCanvas,
  vrDevice
) {
  err(
    'Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead.'
  )
  Module['requestFullScreen'] = Module['requestFullscreen']
  Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice)
}
Module['requestFullscreen'] = function Module_requestFullscreen (
  lockPointer,
  resizeCanvas,
  vrDevice
) {
  Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
}
Module['requestAnimationFrame'] = function Module_requestAnimationFrame (func) {
  Browser.requestAnimationFrame(func)
}
Module['setCanvasSize'] = function Module_setCanvasSize (
  width,
  height,
  noUpdates
) {
  Browser.setCanvasSize(width, height, noUpdates)
}
Module['pauseMainLoop'] = function Module_pauseMainLoop () {
  Browser.mainLoop.pause()
}
Module['resumeMainLoop'] = function Module_resumeMainLoop () {
  Browser.mainLoop.resume()
}
Module['getUserMedia'] = function Module_getUserMedia () {
  Browser.getUserMedia()
}
Module['createContext'] = function Module_createContext (
  canvas,
  useWebGL,
  setInModule,
  webGLContextAttributes
) {
  return Browser.createContext(
    canvas,
    useWebGL,
    setInModule,
    webGLContextAttributes
  )
}
if (ENVIRONMENT_IS_NODE) {
  _emscripten_get_now = function _emscripten_get_now_actual () {
    var t = process['hrtime']()
    return t[0] * 1e3 + t[1] / 1e6
  }
} else if (typeof dateNow !== 'undefined') {
  _emscripten_get_now = dateNow
} else if (
  typeof performance === 'object' &&
  performance &&
  typeof performance['now'] === 'function'
) {
  _emscripten_get_now = function () {
    return performance['now']()
  }
} else {
  _emscripten_get_now = Date.now
}
var GLctx
GL.init()
var ASSERTIONS = false
function intArrayFromString (stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1
  var u8array = new Array(len)
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length)
  if (dontAddNull) u8array.length = numBytesWritten
  return u8array
}
var asmLibraryArg = {
  JSEvents_requestFullscreen: _JSEvents_requestFullscreen,
  JSEvents_resizeCanvasForFullscreen: _JSEvents_resizeCanvasForFullscreen,
  __cxa_allocate_exception: ___cxa_allocate_exception,
  __cxa_atexit: ___cxa_atexit,
  __cxa_throw: ___cxa_throw,
  __lock: ___lock,
  __map_file: ___map_file,
  __setErrNo: ___setErrNo,
  __syscall10: ___syscall10,
  __syscall140: ___syscall140,
  __syscall145: ___syscall145,
  __syscall183: ___syscall183,
  __syscall221: ___syscall221,
  __syscall40: ___syscall40,
  __syscall5: ___syscall5,
  __syscall54: ___syscall54,
  __syscall6: ___syscall6,
  __syscall91: ___syscall91,
  __unlock: ___unlock,
  _addDays: __addDays,
  _arraySum: __arraySum,
  _computeUnpackAlignedImageSize: __computeUnpackAlignedImageSize,
  _embind_register_bool: __embind_register_bool,
  _embind_register_emval: __embind_register_emval,
  _embind_register_float: __embind_register_float,
  _embind_register_integer: __embind_register_integer,
  _embind_register_memory_view: __embind_register_memory_view,
  _embind_register_std_string: __embind_register_std_string,
  _embind_register_std_wstring: __embind_register_std_wstring,
  _embind_register_void: __embind_register_void,
  _emscripten_do_request_fullscreen: __emscripten_do_request_fullscreen,
  _emscripten_push_uncounted_main_loop_blocker: __emscripten_push_uncounted_main_loop_blocker,
  _emscripten_syscall_munmap: __emscripten_syscall_munmap,
  _emval_addMethodCaller: __emval_addMethodCaller,
  _emval_allocateDestructors: __emval_allocateDestructors,
  _emval_as: __emval_as,
  _emval_call: __emval_call,
  _emval_call_method: __emval_call_method,
  _emval_call_void_method: __emval_call_void_method,
  _emval_decref: __emval_decref,
  _emval_equals: __emval_equals,
  _emval_get_global: __emval_get_global,
  _emval_get_method_caller: __emval_get_method_caller,
  _emval_get_property: __emval_get_property,
  _emval_incref: __emval_incref,
  _emval_lookupTypes: __emval_lookupTypes,
  _emval_new_cstring: __emval_new_cstring,
  _emval_register: __emval_register,
  _emval_run_destructors: __emval_run_destructors,
  _emval_set_property: __emval_set_property,
  _emval_take_value: __emval_take_value,
  _fillFullscreenChangeEventData: __fillFullscreenChangeEventData,
  _fillMouseEventData: __fillMouseEventData,
  _findCanvasEventTarget: __findCanvasEventTarget,
  _findEventTarget: __findEventTarget,
  _get_canvas_element_size: __get_canvas_element_size,
  _glGenObject: __glGenObject,
  _isLeapYear: __isLeapYear,
  _registerKeyEventCallback: __registerKeyEventCallback,
  _registerMouseEventCallback: __registerMouseEventCallback,
  _registerRestoreOldStyle: __registerRestoreOldStyle,
  _registerUiEventCallback: __registerUiEventCallback,
  _registerWebGlEventCallback: __registerWebGlEventCallback,
  _registerWheelEventCallback: __registerWheelEventCallback,
  _setLetterbox: __setLetterbox,
  _set_canvas_element_size: __set_canvas_element_size,
  abort: _abort,
  abortOnCannotGrowMemory: abortOnCannotGrowMemory,
  atexit: _atexit,
  clock_gettime: _clock_gettime,
  count_emval_handles: count_emval_handles,
  createNamedFunction: createNamedFunction,
  demangle: demangle,
  demangleAll: demangleAll,
  embind_init_charCodes: embind_init_charCodes,
  embind_repr: _embind_repr,
  emscriptenWebGLGet: emscriptenWebGLGet,
  emscriptenWebGLGetTexPixelData: emscriptenWebGLGetTexPixelData,
  emscripten_asm_const_iii: _emscripten_asm_const_iii,
  emscripten_async_call: _emscripten_async_call,
  emscripten_exit_fullscreen: _emscripten_exit_fullscreen,
  emscripten_get_canvas_element_size: _emscripten_get_canvas_element_size,
  emscripten_get_device_pixel_ratio: _emscripten_get_device_pixel_ratio,
  emscripten_get_element_css_size: _emscripten_get_element_css_size,
  emscripten_get_environ: _emscripten_get_environ,
  emscripten_get_fullscreen_status: _emscripten_get_fullscreen_status,
  emscripten_get_heap_size: _emscripten_get_heap_size,
  emscripten_get_mouse_status: _emscripten_get_mouse_status,
  emscripten_get_now: _emscripten_get_now,
  emscripten_get_now_is_monotonic: _emscripten_get_now_is_monotonic,
  emscripten_get_sbrk_ptr: _emscripten_get_sbrk_ptr,
  emscripten_longjmp: _emscripten_longjmp,
  emscripten_memcpy_big: _emscripten_memcpy_big,
  emscripten_realloc_buffer: emscripten_realloc_buffer,
  emscripten_request_fullscreen_strategy: _emscripten_request_fullscreen_strategy,
  emscripten_resize_heap: _emscripten_resize_heap,
  emscripten_set_canvas_element_size: _emscripten_set_canvas_element_size,
  emscripten_set_click_callback_on_thread: _emscripten_set_click_callback_on_thread,
  emscripten_set_dblclick_callback_on_thread: _emscripten_set_dblclick_callback_on_thread,
  emscripten_set_keydown_callback_on_thread: _emscripten_set_keydown_callback_on_thread,
  emscripten_set_keyup_callback_on_thread: _emscripten_set_keyup_callback_on_thread,
  emscripten_set_main_loop: _emscripten_set_main_loop,
  emscripten_set_main_loop_timing: _emscripten_set_main_loop_timing,
  emscripten_set_mousedown_callback_on_thread: _emscripten_set_mousedown_callback_on_thread,
  emscripten_set_mouseleave_callback_on_thread: _emscripten_set_mouseleave_callback_on_thread,
  emscripten_set_mousemove_callback_on_thread: _emscripten_set_mousemove_callback_on_thread,
  emscripten_set_mouseup_callback_on_thread: _emscripten_set_mouseup_callback_on_thread,
  emscripten_set_resize_callback_on_thread: _emscripten_set_resize_callback_on_thread,
  emscripten_set_webglcontextlost_callback_on_thread: _emscripten_set_webglcontextlost_callback_on_thread,
  emscripten_set_webglcontextrestored_callback_on_thread: _emscripten_set_webglcontextrestored_callback_on_thread,
  emscripten_set_wheel_callback_on_thread: _emscripten_set_wheel_callback_on_thread,
  emscripten_webgl_create_context: _emscripten_webgl_create_context,
  emscripten_webgl_destroy_context: _emscripten_webgl_destroy_context,
  emscripten_webgl_destroy_context_calling_thread: _emscripten_webgl_destroy_context_calling_thread,
  emscripten_webgl_do_create_context: _emscripten_webgl_do_create_context,
  emscripten_webgl_init_context_attributes: _emscripten_webgl_init_context_attributes,
  emscripten_webgl_make_context_current: _emscripten_webgl_make_context_current,
  emval_get_global: emval_get_global,
  environ_get: _environ_get,
  environ_sizes_get: _environ_sizes_get,
  exit: _exit,
  extendError: extendError,
  fd_write: _fd_write,
  floatReadValueFromPointer: floatReadValueFromPointer,
  getShiftFromSize: getShiftFromSize,
  getStringOrSymbol: getStringOrSymbol,
  getTempRet0: _getTempRet0,
  getTypeName: getTypeName,
  get_first_emval: get_first_emval,
  glActiveTexture: _glActiveTexture,
  glAttachShader: _glAttachShader,
  glBindAttribLocation: _glBindAttribLocation,
  glBindBuffer: _glBindBuffer,
  glBindTexture: _glBindTexture,
  glBlendFunc: _glBlendFunc,
  glBufferData: _glBufferData,
  glClear: _glClear,
  glClearColor: _glClearColor,
  glClearDepthf: _glClearDepthf,
  glColorMask: _glColorMask,
  glCompileShader: _glCompileShader,
  glCreateProgram: _glCreateProgram,
  glCreateShader: _glCreateShader,
  glCullFace: _glCullFace,
  glDeleteBuffers: _glDeleteBuffers,
  glDeleteTextures: _glDeleteTextures,
  glDepthFunc: _glDepthFunc,
  glDepthMask: _glDepthMask,
  glDepthRangef: _glDepthRangef,
  glDisable: _glDisable,
  glDisableVertexAttribArray: _glDisableVertexAttribArray,
  glDrawArrays: _glDrawArrays,
  glDrawElements: _glDrawElements,
  glEnable: _glEnable,
  glEnableVertexAttribArray: _glEnableVertexAttribArray,
  glFinish: _glFinish,
  glFlush: _glFlush,
  glFrontFace: _glFrontFace,
  glGenBuffers: _glGenBuffers,
  glGenTextures: _glGenTextures,
  glGetError: _glGetError,
  glGetIntegerv: _glGetIntegerv,
  glGetProgramInfoLog: _glGetProgramInfoLog,
  glGetProgramiv: _glGetProgramiv,
  glGetShaderInfoLog: _glGetShaderInfoLog,
  glGetShaderiv: _glGetShaderiv,
  glGetString: _glGetString,
  glGetUniformLocation: _glGetUniformLocation,
  glLinkProgram: _glLinkProgram,
  glReadPixels: _glReadPixels,
  glShaderSource: _glShaderSource,
  glTexImage2D: _glTexImage2D,
  glTexParameteri: _glTexParameteri,
  glUniform1f: _glUniform1f,
  glUniform1i: _glUniform1i,
  glUniform3f: _glUniform3f,
  glUniform4f: _glUniform4f,
  glUniformMatrix4fv: _glUniformMatrix4fv,
  glUseProgram: _glUseProgram,
  glVertexAttrib4f: _glVertexAttrib4f,
  glVertexAttribPointer: _glVertexAttribPointer,
  glViewport: _glViewport,
  init_emval: init_emval,
  integerReadValueFromPointer: integerReadValueFromPointer,
  invoke_ii: invoke_ii,
  invoke_iii: invoke_iii,
  invoke_iiii: invoke_iiii,
  invoke_iiiii: invoke_iiiii,
  invoke_vi: invoke_vi,
  invoke_vii: invoke_vii,
  invoke_viii: invoke_viii,
  invoke_viiii: invoke_viiii,
  invoke_viiiiiiiii: invoke_viiiiiiiii,
  jsStackTrace: jsStackTrace,
  longjmp: _longjmp,
  makeLegalFunctionName: makeLegalFunctionName,
  memcpy: _memcpy,
  memory: wasmMemory,
  memset: _memset,
  new_: new_,
  readLatin1String: readLatin1String,
  registerType: registerType,
  requireHandle: requireHandle,
  requireRegisteredType: requireRegisteredType,
  runDestructors: runDestructors,
  saveSetjmp: _saveSetjmp,
  setTempRet0: _setTempRet0,
  simpleReadValueFromPointer: simpleReadValueFromPointer,
  stackTrace: stackTrace,
  strftime: _strftime,
  strftime_l: _strftime_l,
  stringToNewUTF8: stringToNewUTF8,
  table: wasmTable,
  testSetjmp: _testSetjmp,
  throwBindingError: throwBindingError,
  throwInternalError: throwInternalError,
  whenDependentTypesAreResolved: whenDependentTypesAreResolved
}
var asm = createWasm()
Module['asm'] = asm
var ___wasm_call_ctors = (Module['___wasm_call_ctors'] = function () {
  return Module['asm']['__wasm_call_ctors'].apply(null, arguments)
})
var _main = (Module['_main'] = function () {
  return Module['asm']['main'].apply(null, arguments)
})
var _malloc = (Module['_malloc'] = function () {
  return Module['asm']['malloc'].apply(null, arguments)
})
var _free = (Module['_free'] = function () {
  return Module['asm']['free'].apply(null, arguments)
})
var ___errno_location = (Module['___errno_location'] = function () {
  return Module['asm']['__errno_location'].apply(null, arguments)
})
var _realloc = (Module['_realloc'] = function () {
  return Module['asm']['realloc'].apply(null, arguments)
})
var _setThrew = (Module['_setThrew'] = function () {
  return Module['asm']['setThrew'].apply(null, arguments)
})
var __ZSt18uncaught_exceptionv = (Module[
  '__ZSt18uncaught_exceptionv'
] = function () {
  return Module['asm']['_ZSt18uncaught_exceptionv'].apply(null, arguments)
})
var ___getTypeName = (Module['___getTypeName'] = function () {
  return Module['asm']['__getTypeName'].apply(null, arguments)
})
var ___embind_register_native_and_builtin_types = (Module[
  '___embind_register_native_and_builtin_types'
] = function () {
  return Module['asm']['__embind_register_native_and_builtin_types'].apply(
    null,
    arguments
  )
})
var dynCall_ii = (Module['dynCall_ii'] = function () {
  return Module['asm']['dynCall_ii'].apply(null, arguments)
})
var dynCall_iii = (Module['dynCall_iii'] = function () {
  return Module['asm']['dynCall_iii'].apply(null, arguments)
})
var dynCall_iiii = (Module['dynCall_iiii'] = function () {
  return Module['asm']['dynCall_iiii'].apply(null, arguments)
})
var dynCall_iiiii = (Module['dynCall_iiiii'] = function () {
  return Module['asm']['dynCall_iiiii'].apply(null, arguments)
})
var dynCall_vi = (Module['dynCall_vi'] = function () {
  return Module['asm']['dynCall_vi'].apply(null, arguments)
})
var dynCall_vii = (Module['dynCall_vii'] = function () {
  return Module['asm']['dynCall_vii'].apply(null, arguments)
})
var dynCall_viii = (Module['dynCall_viii'] = function () {
  return Module['asm']['dynCall_viii'].apply(null, arguments)
})
var dynCall_viiii = (Module['dynCall_viiii'] = function () {
  return Module['asm']['dynCall_viiii'].apply(null, arguments)
})
var dynCall_viiiiiiiii = (Module['dynCall_viiiiiiiii'] = function () {
  return Module['asm']['dynCall_viiiiiiiii'].apply(null, arguments)
})
var stackSave = (Module['stackSave'] = function () {
  return Module['asm']['stackSave'].apply(null, arguments)
})
var stackAlloc = (Module['stackAlloc'] = function () {
  return Module['asm']['stackAlloc'].apply(null, arguments)
})
var stackRestore = (Module['stackRestore'] = function () {
  return Module['asm']['stackRestore'].apply(null, arguments)
})
var __growWasmMemory = (Module['__growWasmMemory'] = function () {
  return Module['asm']['__growWasmMemory'].apply(null, arguments)
})
var dynCall_viidiiii = (Module['dynCall_viidiiii'] = function () {
  return Module['asm']['dynCall_viidiiii'].apply(null, arguments)
})
var dynCall_viiiiii = (Module['dynCall_viiiiii'] = function () {
  return Module['asm']['dynCall_viiiiii'].apply(null, arguments)
})
var dynCall_viiiiiiii = (Module['dynCall_viiiiiiii'] = function () {
  return Module['asm']['dynCall_viiiiiiii'].apply(null, arguments)
})
var dynCall_v = (Module['dynCall_v'] = function () {
  return Module['asm']['dynCall_v'].apply(null, arguments)
})
var dynCall_vid = (Module['dynCall_vid'] = function () {
  return Module['asm']['dynCall_vid'].apply(null, arguments)
})
var dynCall_viid = (Module['dynCall_viid'] = function () {
  return Module['asm']['dynCall_viid'].apply(null, arguments)
})
var dynCall_diid = (Module['dynCall_diid'] = function () {
  return Module['asm']['dynCall_diid'].apply(null, arguments)
})
var dynCall_viiiii = (Module['dynCall_viiiii'] = function () {
  return Module['asm']['dynCall_viiiii'].apply(null, arguments)
})
var dynCall_di = (Module['dynCall_di'] = function () {
  return Module['asm']['dynCall_di'].apply(null, arguments)
})
var dynCall_vidd = (Module['dynCall_vidd'] = function () {
  return Module['asm']['dynCall_vidd'].apply(null, arguments)
})
var dynCall_viidddd = (Module['dynCall_viidddd'] = function () {
  return Module['asm']['dynCall_viidddd'].apply(null, arguments)
})
var dynCall_viddddii = (Module['dynCall_viddddii'] = function () {
  return Module['asm']['dynCall_viddddii'].apply(null, arguments)
})
var dynCall_viddd = (Module['dynCall_viddd'] = function () {
  return Module['asm']['dynCall_viddd'].apply(null, arguments)
})
var dynCall_viidiii = (Module['dynCall_viidiii'] = function () {
  return Module['asm']['dynCall_viidiii'].apply(null, arguments)
})
var dynCall_viijii = (Module['dynCall_viijii'] = function () {
  return Module['asm']['dynCall_viijii'].apply(null, arguments)
})
var dynCall_vij = (Module['dynCall_vij'] = function () {
  return Module['asm']['dynCall_vij'].apply(null, arguments)
})
var dynCall_iiij = (Module['dynCall_iiij'] = function () {
  return Module['asm']['dynCall_iiij'].apply(null, arguments)
})
var dynCall_ji = (Module['dynCall_ji'] = function () {
  return Module['asm']['dynCall_ji'].apply(null, arguments)
})
var dynCall_iij = (Module['dynCall_iij'] = function () {
  return Module['asm']['dynCall_iij'].apply(null, arguments)
})
var dynCall_iiid = (Module['dynCall_iiid'] = function () {
  return Module['asm']['dynCall_iiid'].apply(null, arguments)
})
var dynCall_iiiiii = (Module['dynCall_iiiiii'] = function () {
  return Module['asm']['dynCall_iiiiii'].apply(null, arguments)
})
var dynCall_iiiiiiiiii = (Module['dynCall_iiiiiiiiii'] = function () {
  return Module['asm']['dynCall_iiiiiiiiii'].apply(null, arguments)
})
var dynCall_iiiiiii = (Module['dynCall_iiiiiii'] = function () {
  return Module['asm']['dynCall_iiiiiii'].apply(null, arguments)
})
var dynCall_iiiiiiii = (Module['dynCall_iiiiiiii'] = function () {
  return Module['asm']['dynCall_iiiiiiii'].apply(null, arguments)
})
var dynCall_iidiiii = (Module['dynCall_iidiiii'] = function () {
  return Module['asm']['dynCall_iidiiii'].apply(null, arguments)
})
var dynCall_jiji = (Module['dynCall_jiji'] = function () {
  return Module['asm']['dynCall_jiji'].apply(null, arguments)
})
var dynCall_iiiiiiiii = (Module['dynCall_iiiiiiiii'] = function () {
  return Module['asm']['dynCall_iiiiiiiii'].apply(null, arguments)
})
var dynCall_iiiiij = (Module['dynCall_iiiiij'] = function () {
  return Module['asm']['dynCall_iiiiij'].apply(null, arguments)
})
var dynCall_iiiiid = (Module['dynCall_iiiiid'] = function () {
  return Module['asm']['dynCall_iiiiid'].apply(null, arguments)
})
var dynCall_iiiiijj = (Module['dynCall_iiiiijj'] = function () {
  return Module['asm']['dynCall_iiiiijj'].apply(null, arguments)
})
var dynCall_iiiiiijj = (Module['dynCall_iiiiiijj'] = function () {
  return Module['asm']['dynCall_iiiiiijj'].apply(null, arguments)
})
function invoke_iiiii (index, a1, a2, a3, a4) {
  var sp = stackSave()
  try {
    return dynCall_iiiii(index, a1, a2, a3, a4)
  } catch (e) {
    stackRestore(sp)
    if (e !== e + 0 && e !== 'longjmp') throw e
    _setThrew(1, 0)
  }
}
function invoke_ii (index, a1) {
  var sp = stackSave()
  try {
    return dynCall_ii(index, a1)
  } catch (e) {
    stackRestore(sp)
    if (e !== e + 0 && e !== 'longjmp') throw e
    _setThrew(1, 0)
  }
}
function invoke_iiii (index, a1, a2, a3) {
  var sp = stackSave()
  try {
    return dynCall_iiii(index, a1, a2, a3)
  } catch (e) {
    stackRestore(sp)
    if (e !== e + 0 && e !== 'longjmp') throw e
    _setThrew(1, 0)
  }
}
function invoke_viii (index, a1, a2, a3) {
  var sp = stackSave()
  try {
    dynCall_viii(index, a1, a2, a3)
  } catch (e) {
    stackRestore(sp)
    if (e !== e + 0 && e !== 'longjmp') throw e
    _setThrew(1, 0)
  }
}
function invoke_viiii (index, a1, a2, a3, a4) {
  var sp = stackSave()
  try {
    dynCall_viiii(index, a1, a2, a3, a4)
  } catch (e) {
    stackRestore(sp)
    if (e !== e + 0 && e !== 'longjmp') throw e
    _setThrew(1, 0)
  }
}
function invoke_vii (index, a1, a2) {
  var sp = stackSave()
  try {
    dynCall_vii(index, a1, a2)
  } catch (e) {
    stackRestore(sp)
    if (e !== e + 0 && e !== 'longjmp') throw e
    _setThrew(1, 0)
  }
}
function invoke_viiiiiiiii (index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
  var sp = stackSave()
  try {
    dynCall_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9)
  } catch (e) {
    stackRestore(sp)
    if (e !== e + 0 && e !== 'longjmp') throw e
    _setThrew(1, 0)
  }
}
function invoke_vi (index, a1) {
  var sp = stackSave()
  try {
    dynCall_vi(index, a1)
  } catch (e) {
    stackRestore(sp)
    if (e !== e + 0 && e !== 'longjmp') throw e
    _setThrew(1, 0)
  }
}
function invoke_iii (index, a1, a2) {
  var sp = stackSave()
  try {
    return dynCall_iii(index, a1, a2)
  } catch (e) {
    stackRestore(sp)
    if (e !== e + 0 && e !== 'longjmp') throw e
    _setThrew(1, 0)
  }
}
Module['asm'] = asm
Module['getMemory'] = getMemory
Module['addRunDependency'] = addRunDependency
Module['removeRunDependency'] = removeRunDependency
Module['FS_createFolder'] = FS.createFolder
Module['FS_createPath'] = FS.createPath
Module['FS_createDataFile'] = FS.createDataFile
Module['FS_createPreloadedFile'] = FS.createPreloadedFile
Module['FS_createLazyFile'] = FS.createLazyFile
Module['FS_createLink'] = FS.createLink
Module['FS_createDevice'] = FS.createDevice
Module['FS_unlink'] = FS.unlink
Module['calledRun'] = calledRun
var calledRun
function ExitStatus (status) {
  this.name = 'ExitStatus'
  this.message = 'Program terminated with exit(' + status + ')'
  this.status = status
}
var calledMain = false
dependenciesFulfilled = function runCaller () {
  if (!calledRun) run()
  if (!calledRun) dependenciesFulfilled = runCaller
}
function callMain (args) {
  args = args || []
  var argc = args.length + 1
  var argv = stackAlloc((argc + 1) * 4)
  HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram)
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1])
  }
  HEAP32[(argv >> 2) + argc] = 0
  try {
    var ret = Module['_main'](argc, argv)
    exit(ret, true)
  } catch (e) {
    if (e instanceof ExitStatus) {
      return
    } else if (e == 'SimulateInfiniteLoop') {
      noExitRuntime = true
      return
    } else {
      var toLog = e
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack]
      }
      err('exception thrown: ' + toLog)
      quit_(1, e)
    }
  } finally {
    calledMain = true
  }
}
function run (args) {
  args = args || arguments_
  if (runDependencies > 0) {
    return
  }
  preRun()
  if (runDependencies > 0) return
  function doRun () {
    if (calledRun) return
    calledRun = true
    Module['calledRun'] = true
    if (ABORT) return
    initRuntime()
    preMain()
    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']()
    if (shouldRunNow) callMain(args)
    postRun()
  }
  if (Module['setStatus']) {
    Module['setStatus']('Running...')
    setTimeout(function () {
      setTimeout(function () {
        Module['setStatus']('')
      }, 1)
      doRun()
    }, 1)
  } else {
    doRun()
  }
}
Module['run'] = run
function exit (status, implicit) {
  if (implicit && noExitRuntime && status === 0) {
    return
  }
  if (noExitRuntime) {
  } else {
    ABORT = true
    EXITSTATUS = status
    exitRuntime()
    if (Module['onExit']) Module['onExit'](status)
  }
  quit_(status, new ExitStatus(status))
}
if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function')
    Module['preInit'] = [Module['preInit']]
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()()
  }
}
var shouldRunNow = true
if (Module['noInitialRun']) shouldRunNow = false
noExitRuntime = true
run()
