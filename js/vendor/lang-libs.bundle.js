var LIBS_LOADER = (() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a3, b3) => (typeof require !== "undefined" ? require : a3)[b3]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // js/vendor/j-toml.mjs
  var Ln = "1.38.0";
  var f = SyntaxError;
  var b = RangeError;
  var h = TypeError;
  var I = Error;
  var S = void 0;
  var Y = typeof BigInt > "u" ? S : BigInt;
  var St = RegExp;
  var Lt = WeakMap;
  var $n = WeakMap.prototype.get;
  var An = WeakMap.prototype.set;
  var v = Object.create;
  var _e = Number.isSafeInteger;
  var H = Object.getOwnPropertyNames;
  var $ = Object.freeze;
  var Fn = Object.prototype.isPrototypeOf;
  var A = Object.seal ? Object.preventExtensions(/* @__PURE__ */ Object.create(null)) : null;
  var Te = Function.prototype.bind;
  var Dn = RegExp.prototype.test;
  var vn = RegExp.prototype.exec;
  var $t = Reflect.apply;
  var At = Proxy;
  var Cn = typeof Symbol > "u" ? S : Symbol.toStringTag;
  var Nn = Object.defineProperty;
  var R = Object.assign;
  var Ft = Object;
  var mr = Math.floor;
  var ce = Array.isArray;
  var we = 1 / 0;
  var Dt = String.fromCharCode;
  var Ye = Array;
  var He = Object.prototype.hasOwnProperty;
  var Mn = Object.prototype.propertyIsEnumerable;
  var Q = Function.prototype.apply;
  var Bn = Mn.call.bind(Mn);
  var J = Ft.hasOwn || (function() {
    return He.bind ? He.call.bind(He) : function(t, n) {
      return He.call(t, n);
    };
  })();
  var kn = Ft.create;
  function Un(e) {
    var t = kn(A);
    return J(e, "value") && (t.value = e.value), J(e, "writable") && (t.writable = e.writable), J(e, "get") && (t.get = e.get), J(e, "set") && (t.set = e.set), J(e, "enumerable") && (t.enumerable = e.enumerable), J(e, "configurable") && (t.configurable = e.configurable), t;
  }
  var xr = (function(t, n) {
    if (!n && typeof t != "function" && (n = t, t = v(A)), R) R(t, n);
    else for (var s in n) J(n, s) && (t[s] = n[s]);
    if (t.default = t, typeof t == "function") t.prototype && $(t.prototype);
    else if (Cn) {
      var r = v(A);
      r.value = "Module", Nn(t, Cn, r);
    }
    return $(t);
  });
  var Pn = Te ? Te.bind(Dn) : function(e) {
    return function(t) {
      return Dn.call(e, t);
    };
  };
  var jn = Te ? Te.bind(vn) : function(e) {
    return function(t) {
      return vn.call(e, t);
    };
  };
  function Ir(e) {
    var t = e.test = Pn(e), n = e.exec = jn(e), s = t.source = n.source = e.source;
    return t.unicode = n.unicode = e.unicode, t.ignoreCase = n.ignoreCase = e.ignoreCase, t.multiline = n.multiline = s.indexOf("^") < 0 && s.indexOf("$") < 0 ? null : e.multiline, t.dotAll = n.dotAll = s.indexOf(".") < 0 ? null : e.dotAll, e;
  }
  function _(e) {
    return Ir(e);
  }
  var Wn = /[\n\t]+/g;
  var Er = /\\./g;
  function Or(e) {
    return e === "\\`" ? "`" : e;
  }
  var k = "".includes ? function(e, t) {
    return e.includes(t);
  } : function(e, t) {
    return e.indexOf(t) > -1;
  };
  function be(e) {
    for (var t = this.U, n = this.I, s = this.M, r = this.S, o2 = e.raw, i = o2[0].replace(Wn, ""), c = 1, u = arguments.length; c !== u; ) {
      var d2 = arguments[c];
      if (typeof d2 == "string") i += d2;
      else {
        var g2 = d2.source;
        if (typeof g2 != "string") throw h("source");
        if (d2.unicode === t) throw f("unicode");
        if (d2.ignoreCase === n) throw f("ignoreCase");
        if (d2.multiline === s && (k(g2, "^") || k(g2, "$"))) throw f("multiline");
        if (d2.dotAll === r && k(g2, ".")) throw f("dotAll");
        i += g2;
      }
      i += o2[c++].replace(Wn, "");
    }
    var p = St(t ? i = i.replace(Er, Or) : i, this.flags), x = p.test = Pn(p), w2 = p.exec = jn(p);
    return x.source = w2.source = i, x.unicode = w2.unicode = !t, x.ignoreCase = w2.ignoreCase = !n, x.multiline = w2.multiline = k(i, "^") || k(i, "$") ? !s : null, x.dotAll = w2.dotAll = k(i, ".") ? !r : null, p;
  }
  var Sr = Te && Te.bind(be);
  function vt(e) {
    return { U: !k(e, "u"), I: !k(e, "i"), M: !k(e, "m"), S: !k(e, "s"), flags: e };
  }
  var Gn = vt("");
  var T = At ? new At(be, { apply: function(e, t, n) {
    return $t(e, Gn, n);
  }, get: function(e, t) {
    return Sr(vt(t));
  }, defineProperty: function() {
    return false;
  }, preventExtensions: function() {
    return false;
  } }) : (function() {
    be.apply = be.apply;
    for (var e = function() {
      return be.apply(Gn, arguments);
    }, t = 1, n = t * 2, s = n * 2, r = s * 2, o2 = s * 2, i = o2 * 2, c = i * 2, u = c * 2 - 1; u--; ) (function(d2) {
      e[d2.flags] = function() {
        return be.apply(d2, arguments);
      };
    })(vt((u & t ? "" : "d") + (u & n ? "" : "g") + (u & s ? "" : "i") + (u & r ? "" : "m") + (u & o2 ? "" : "s") + (u & i ? "" : "u") + (u & c ? "" : "y")));
    return $ ? $(e) : e;
  })();
  var Lr = "$_" in St ? (function() {
    var e = /^/;
    return e.test = e.test, function(n) {
      return e.test(""), n;
    };
  })() : function(t) {
    return t;
  };
  var Yn = Lr;
  var $r = /^[$()*+\-.?[\\\]^{|]/;
  var Ar = v(A);
  function Fr(e, t, n) {
    for (var s = v(A), r = Hn, o2 = e.length, i = 0; i < o2; ++i) r(s, e[i]);
    return Zn(s);
  }
  function Hn(e, t) {
    if (t) {
      var n = t.charAt(0);
      Hn(e[n] || (e[n] = v(A)), t.slice(1));
    } else e[""] = Ar;
  }
  function Zn(e, t) {
    var n = [], s = [], r = true;
    for (var o2 in e) if (o2) {
      var i = Zn(e[o2]);
      $r.test(o2) && (o2 = "\\" + o2), i ? n.push(o2 + i) : s.push(o2);
    } else r = false;
    return s.length && n.unshift(s.length === 1 ? s[0] : "[" + s.join("") + "]"), n.length === 0 ? "" : (n.length === 1 && (s.length || r) ? n[0] : "(?:" + n.join("|") + ")") + (r ? "" : "?");
  }
  var ae = WeakSet;
  var ye = WeakSet.prototype.has;
  var le = WeakSet.prototype.add;
  var zn = WeakSet.prototype.delete;
  var Xn = Object.keys;
  var Ze = Object.getOwnPropertySymbols;
  var C = (function() {
    var e = Object.assign || function(r, o2) {
      var i, c, u;
      for (i = Xn(o2), c = 0; c < i.length; ++c) u = i[c], r[u] = o2[u];
      if (Ze) for (i = Ze(o2), c = 0; c < i.length; ++c) u = i[c], Bn(o2, u) && (r[u] = o2[u]);
      return r;
    };
    function t(s) {
      return delete s.prototype.constructor, $(s.prototype), s;
    }
    function n(s) {
      return s === S ? this : typeof s == "function" ? t(s) : e(kn(A), s);
    }
    return delete n.name, n.prototype = null, $(n), n;
  })();
  var Ct = Object.is;
  var Dr = Object.defineProperties;
  var vr = Object.fromEntries;
  var Cr = Reflect.construct;
  var Kn = Reflect.defineProperty;
  var Nr = Reflect.deleteProperty;
  var qn = Reflect.ownKeys;
  var Vn = () => [];
  var Nt = () => {
    const e = new Lt();
    return e.has = e.has, e.get = e.get, e.set = e.set, e;
  };
  var ze = Nt();
  var Rn = Nt();
  var Qn = Nt();
  var Mr = R(v(A), { defineProperty: (e, t, n) => {
    if (J(e, t)) return Kn(e, t, R(v(A), n));
    if (Kn(e, t, R(v(A), n))) {
      const s = ze.get(e);
      return s[s.length] = t, true;
    }
    return false;
  }, deleteProperty: (e, t) => {
    if (Nr(e, t)) {
      const n = ze.get(e), s = n.indexOf(t);
      return s < 0 || --n.copyWithin(s, s + 1).length, true;
    }
    return false;
  }, ownKeys: (e) => ze.get(e), construct: (e, t, n) => es(Cr(e, t, n)), apply: (e, t, n) => es($t(e, t, n)) });
  var Jn = (e, t) => {
    ze.set(e, t);
    const n = new At(e, Mr);
    return Rn.set(n, e), n;
  };
  var es = (e) => {
    if (Rn.has(e)) return e;
    let t = Qn.get(e);
    return t || (t = Jn(e, R(Vn(), qn(e))), Qn.set(e, t), t);
  };
  var Br = (function() {
    function e() {
      throw h("Super constructor Null cannot be invoked with 'new'");
    }
    function t() {
      throw h("Super constructor Null cannot be invoked without 'new'");
    }
    const n = (r) => (delete r.prototype.constructor, $(r.prototype), r);
    function s(r) {
      return new.target ? new.target === s ? e() : Jn(this, Vn()) : typeof r == "function" ? n(r) : t();
    }
    return s.prototype = null, Nn(s, "name", R(v(A), { value: "", configurable: false })), $(s), s;
  })();
  var kr = WeakMap.prototype.has;
  var Ur = WeakMap.prototype.delete;
  var Xe = new Lt();
  var Mt = new ae();
  var ts = Ur.bind(Xe);
  var ns = zn.bind(Mt);
  var Ke = kr.bind(Xe);
  var Pr = $n.bind(Xe);
  var Z = An.bind(Xe);
  var ss = (e, t, n) => {
    if (ce(e)) {
      if (n) t = 3;
      else if (t === S) t = 3;
      else if (t !== 0 && t !== 1 && t !== 2 && t !== 3) throw typeof t == "number" ? b(`array inline mode must be 0 | 1 | 2 | 3, not including ${t}`) : h(`array inline mode must be "number" type, not including ${t === null ? '"null"' : typeof t}`);
      Z(e, t);
    } else Z(e, true), ns(e);
    return e;
  };
  var jr = (e) => (Z(e, false), ns(e), e);
  var Wr = (e) => (ts(e), e);
  var me = ye.bind(Mt);
  var qe = le.bind(Mt);
  var rs = (e) => {
    if (ce(e)) throw h("array can not be section, maybe you want to use it on the tables in it");
    return qe(e), ts(e), e;
  };
  var Gr = true;
  var is = new ae();
  var os = le.bind(is);
  var cs = ye.bind(is);
  var as = new ae();
  var ls = le.bind(as);
  var Yr = zn.bind(as);
  var Hr = (e) => Yr(e) ? (qe(e), true) : false;
  var Bt = true;
  var Ve = false;
  var us = new ae();
  var fs = le.bind(us);
  var hs = ye.bind(us);
  var ds = true;
  var ps = C(class extends C {
    constructor(t, n) {
      return super(), os(this), t ? n ? Z(this, true) : qe(this) : (n ? fs : ls)(this), this;
    }
  });
  var Zr = C(class extends Br {
    constructor(t, n) {
      return super(), os(this), t ? n ? Z(this, true) : qe(this) : (n ? fs : ls)(this), this;
    }
  });
  var kt = [];
  var Re = "";
  var z = kt;
  var Ut = -1;
  var X = -1;
  var a = (e) => {
    throw e;
  };
  var zr = /\r?\n/;
  var Xr = (e, t) => {
    if (typeof t != "string") throw h("TOML.parse({ path })");
    Re = t, z = e.split(zr), Ut = z.length - 1, X = -1;
  };
  var Kr = () => z[++X];
  var qr = () => X !== Ut;
  var Qe = class {
    constructor(t, n) {
      __publicField(this, "lineIndex", X);
      __publicField(this, "type");
      __publicField(this, "restColumn");
      return this.type = t, this.restColumn = n, this;
    }
    must() {
      return X === Ut && a(f(`${this.type} is not close until the end of the file` + l(", which started from ", this.lineIndex, z[this.lineIndex].length - this.restColumn + 1))), z[++X];
    }
    nowrap(t) {
      throw a(I(`TOML.parse(${t ? `${t}multilineStringJoiner` : ",{ joiner }"}) must be passed, while the source including multi-line string` + l(", which started from ", this.lineIndex, z[this.lineIndex].length - this.restColumn + 1)));
    }
  };
  var l = (e, t = X, n = 0) => z === kt ? "" : Re ? `
    at (${Re}:${t + 1}:${n})` : `${e}line ${t + 1}: ${z[t]}`;
  var Vr = () => {
    Re = "", z = kt;
  };
  var M = /[ \t]/;
  var L = T`
	^${M}+`.valueOf();
  var { exec: gs } = T.s`
	^
	(
		(?:\d\d\d\d-\d\d-\d\d \d)?
		[\w\-+.:]+
	)
	${M}*
	(.*)
	$`.valueOf();
  var { exec: Rr } = T.s`
	^
	'([^']*)'
	${M}*
	(.*)`.valueOf();
  var { exec: Qr } = T.s`
	^
	(.*?)
	'''('{0,2})
	${M}*
	(.*)`.valueOf();
  var { exec: Je } = T.s`
	^
	(.*?)
	'''()
	${M}*
	(.*)`.valueOf();
  var ue = Je;
  var U = T.s`
	^
	.
	${M}*`.valueOf();
  var Pt = /[^\x00-\x1F"#'()<>[\\\]`{}\x7F]+/;
  var { exec: Jr } = T.s`
	^
	${M}*
	=
	${M}*
	(?:
		<(${Pt})>
		${M}*
	)?
	(.*)
	$`.valueOf();
  var { exec: ei } = T.s`
	^
	<(${Pt})>
	${M}*
	(.*)
	$`.valueOf();
  var { exec: ti } = T.s`
	^
	<(${Pt})>
	${M}*
	(.*)
	$`.valueOf();
  var _s = _(/[^\\"]+|\\.?|"(?!"")"?/sy);
  var jt = (e) => {
    let t = 0;
    for (; _s.test(e); ) t = _s.lastIndex;
    return t;
  };
  var Ts = /[^\\\x00-\x08\x0B-\x1F\x7F]+|\\(?:[btnfr"\\]|[\t ]*\n[\t\n ]*|u[\dA-Fa-f]{4}|U[\dA-Fa-f]{8})/g;
  var ni = /[^\\\x00-\x09\x0B-\x1F\x7F]+|\\(?:[btnfr"\\]|[\t ]*\n[\t\n ]*|u[\dA-Fa-f]{4}|U[\dA-Fa-f]{8})/g;
  var si = /[^\\\x00-\x09\x0B-\x1F]+|\\(?:[btnfr"\\]|[\t ]*\n[\t\n ]*|u[\dA-Fa-f]{4}|U[\dA-Fa-f]{8})/g;
  var ri = /[^\\\x00-\x09\x0B-\x1F]+|\\(?:[btnfr"\\/]|[\t ]*\n[\t\n ]*|u[\dA-Fa-f]{4}|U[\dA-Fa-f]{8})/g;
  var ve = Ts;
  var Ce = (e) => !e.replace(ve, "");
  var ii = _(/[^\\"\x00-\x08\x0B-\x1F\x7F]+|\\(?:[btnfr"\\]|u[\dA-Fa-f]{4}|U[\dA-Fa-f]{8})/y);
  var oi = _(/[^\\"\x00-\x08\x0B-\x1F\x7F]+|\\(?:[btnfr"\\]|u[\dA-Fa-f]{4}|U[\dA-Fa-f]{8})/y);
  var ci = _(/[^\\"\x00-\x08\x0B-\x1F]+|\\(?:[btnfr"\\]|u[\dA-Fa-f]{4}|U[\dA-Fa-f]{8})/y);
  var ws = _(/[^\\"\x00-\x08\x0B-\x1F]+|\\(?:[btnfr"\\/]|u[\dA-Fa-f]{4}|U[\dA-Fa-f]{8})/y);
  var fe = ws;
  var bs = (e) => {
    let t = fe.lastIndex = 1;
    for (; fe.test(e); ) t = fe.lastIndex;
    return t !== e.length && e[t] === '"' || a(f("Bad basic string" + l(" at "))), t;
  };
  var { test: ai } = _(/^[ \t]*\./);
  var li = /^[ \t]*\.[ \t]*/;
  var { exec: Wt } = _(/^[\w-]+/);
  var { exec: ys } = _(/^[^ \t#=[\]'".]+(?:[ \t]+[^ \t#=[\]'".]+)*/);
  var Ne = ys;
  var { exec: ms } = _(/^'[^'\x00-\x08\x0B-\x1F\x7F]*'/);
  var { exec: Gt } = _(/^'[^'\x00-\x08\x0B-\x1F]*'/);
  var Me = Gt;
  var Be = true;
  var ui = (e, t) => {
    const n = e[1] === "[";
    n ? (Be || a(f("Array of Tables is not allowed before TOML v0.2" + l(", which at "))), e = e.slice(2)) : e = e.slice(1), e = e.replace(L, "");
    const { leadingKeys: s, finalKey: r } = { lineRest: e } = t(e);
    e = e.replace(L, ""), e && e[0] === "]" || a(f("Table header is not closed" + l(", which is found at "))), (e.length > 1 ? e[1] === "]" === n : !n) || a(f("Square brackets of Table definition statement not match" + l(" at "))), e = e.slice(n ? 2 : 1).replace(L, "");
    let o2;
    return e && e[0] === "<" ? { 1: o2, 2: e } = ti(e) || a(f("Bad tag" + l(" at "))) : o2 = "", { leadingKeys: s, finalKey: r, asArrayItem: n, tag: o2, lineRest: e };
  };
  var fi = ({ leadingKeys: e, finalKey: t, lineRest: n }) => {
    const { 1: s = "" } = { 2: n } = Jr(n) || a(f("Keys must equal something" + l(", but missing at ")));
    return s || n && n[0] !== "#" || a(f("Value can not be missing after euqal sign" + l(", which is found at "))), { leadingKeys: e, finalKey: t, tag: s, lineRest: n };
  };
  var { test: Yt } = _(/[\x00-\x08\x0B-\x1F\x7F]/);
  var { test: xs } = _(/[\x00-\x08\x0B-\x1F]/);
  var xe = Yt;
  var hi = (e) => {
    switch (e) {
      case 1:
        ue = Qr, Me = ms, xe = Yt, ve = Ts, fe = ii, Ne = Wt, Be = true;
        break;
      case 0.5:
        ue = Je, Me = ms, xe = Yt, ve = ni, fe = oi, Ne = Wt, Be = true;
        break;
      case 0.4:
        ue = Je, Me = Gt, xe = xs, ve = si, fe = ci, Ne = Wt, Be = true;
        break;
      default:
        ue = Je, Me = Gt, xe = xs, ve = ri, fe = ws, Ne = ys, Be = false;
    }
  };
  var Is = T`
	(?:
		0
		(?:
			b[01][_01]*
		|
			o[0-7][_0-7]*
		|
			x[\dA-Fa-f][_\dA-Fa-f]*
		|
			(?:\.\d[_\d]*)?(?:[Ee]-?\d[_\d]*)?
		)
	|
		[1-9][_\d]*
		(?:\.\d[_\d]*)?(?:[Ee]-?\d[_\d]*)?
	|
		inf
	|
		nan
	)
`.valueOf();
  var { test: di } = T`
	^(?:
		-?${Is}
		(?:-${Is})*
	|
		true
	|
		false
	)$
`.valueOf();
  var { test: pi } = T`_(?![\dA-Fa-f])`.valueOf();
  var Es = (e) => di(e) && !pi(e);
  var P = true;
  var y = "";
  var ee = null;
  var Ie = true;
  var Ht = 0;
  var Zt = 0;
  var zt = { test: () => true };
  var Xt = class extends St {
    constructor(t) {
      super(`^${Fr(t)}$`);
      let n = -1;
      for (let s = t.length; s; ) {
        const { length: r } = t[--s];
        r > n && (n = r);
      }
      return this.lastIndex = n + 1, this;
    }
    test(t) {
      return t.length < this.lastIndex && super.test(t);
    }
  };
  var gi = Fn.bind($(Xt.prototype));
  var ke = zt;
  var F;
  var te;
  var ne;
  var N;
  var he;
  var et;
  var de;
  var j;
  var tt;
  var Ue;
  var Kt;
  var nt;
  var Os;
  var Ss = new Lt();
  var _i = $n.bind(Ss);
  var Ti = An.bind(Ss);
  var B = () => {
    const e = (t) => {
      const n = _i(t);
      return n ? n === e || a(h("Types in Array must be same" + l(". Check "))) : Ti(t, e), t;
    };
    return e;
  };
  var wi = { asNulls: B(), asStrings: B(), asTables: B(), asArrays: B(), asBooleans: B(), asFloats: B(), asIntegers: B(), asOffsetDateTimes: B(), asLocalDateTimes: B(), asLocalDates: B(), asLocalTimes: B() };
  var bi = (e) => e;
  var qt;
  var st;
  var Vt;
  var Rt;
  var rt;
  var Qt;
  var Jt;
  var en;
  var tn;
  var nn;
  var sn;
  var rn = null;
  var Ee = null;
  var yi = (e, t, n, s) => {
    const r = v(A);
    r._linked = Ee, r.tag = e, n && (r.table = n, r.key = s), t && (r.array = t, r.index = t.length), Ee = r;
  };
  var on = () => {
    throw a(f("xOptions.tag is not enabled, but found tag syntax" + l(" at ")));
  };
  var pe = on;
  var mi = () => {
    if (Ee) {
      const e = rn;
      let t = Ee;
      return Ee = null, () => {
        const n = e;
        let s = t;
        t = null;
        do
          n(s);
        while (s = s._linked);
      };
    }
    return null;
  };
  var xi = () => {
    ke = zt, ee = rn = Ee = null, te = false;
  };
  var Ii = (e, t, n, s, r, o2) => {
    y = o2;
    let i;
    switch (e) {
      case 1:
        P = i = N = de = ne = true, te = he = false;
        break;
      case 0.5:
        P = N = de = ne = true, i = te = he = false;
        break;
      case 0.4:
        P = he = ne = true, i = te = N = de = false;
        break;
      case 0.3:
        P = he = true, i = te = N = de = ne = false;
        break;
      case 0.2:
        te = he = true, P = i = N = de = ne = false;
        break;
      case 0.1:
        te = he = true, P = i = N = de = ne = false;
        break;
      default:
        throw b("TOML.parse(,specificationVersion)");
    }
    if (hi(e), typeof t == "string") ee = t;
    else if (t === S) ee = null;
    else throw h(`TOML.parse(${y ? `${y}multilineStringJoiner` : ",{ joiner }"})`);
    if (n === S || n === true) Ie = true;
    else if (n === false) Ie = false;
    else {
      if (typeof n != "number") throw h(`TOML.parse(${y ? `${y},useBigInt` : ",{ bigint }"})`);
      if (!_e(n)) throw b(`TOML.parse(${y ? `${y},useBigInt` : ",{ bigint }"})`);
      Ie = null, n >= 0 ? Ht = -(Zt = n) : Zt = -(Ht = n) - 1;
    }
    if (!Y && Ie !== false) throw I(`Can't work without TOML.parse(${y ? `${y},useBigInt` : ",{ bigint }"}) being set to false, because the host doesn't have BigInt support`);
    if (s == null) ke = zt;
    else {
      if (!gi(s)) throw h("TOML.parse(,{ keys })");
      ke = s;
    }
    if (r == null) j = ps, et = tt = Ue = Kt = false, pe = on;
    else {
      if (typeof r != "object") throw h(`TOML.parse(${y ? `${y},,xOptions` : ",{ x }"})`);
      {
        const { order: c, longer: u, exact: d2, null: g2, multi: p, comment: x, string: w2, literal: D3, tag: W2, ...O } = r, G3 = H(O);
        if (G3.length) throw h(`TOML.parse(${y ? `${y},,{ ${G3.join(", ")} }` : `,{ x: { ${G3.join(", ")} } }`})`);
        if (j = c ? Zr : ps, tt = !u, et = !!d2, Ue = !!g2, Kt = !!p, nt = !!x, Os = !!w2, F = !!D3, W2) {
          if (typeof W2 != "function") throw h(`TOML.parse(${y ? `${y},,{ tag }` : ",{ x: { tag } }"})`);
          if (!i) throw h(`TOML.parse(${y ? `${y},,xOptions` : ",{ x }"}) xOptions.tag needs at least TOML 1.0 to support mixed type array`);
          rn = W2, pe = yi;
        } else pe = on;
      }
    }
    i ? qt = st = Vt = Rt = rt = Qt = Jt = en = tn = nn = sn = bi : { asNulls: qt, asStrings: st, asTables: Vt, asArrays: Rt, asBooleans: rt, asFloats: Qt, asIntegers: Jt, asOffsetDateTimes: en, asLocalDateTimes: tn, asLocalDates: nn, asLocalTimes: sn } = wi;
  };
  var Ei = ArrayBuffer.isView;
  var Oi = (function() {
    if (typeof ArrayBuffer == "function") {
      var e = Q.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get);
      return function(n) {
        try {
          e(n);
        } catch {
          return false;
        }
        return true;
      };
    }
    return function() {
      return false;
    };
  })();
  var Si = TextDecoder;
  var E = Symbol;
  var cn = E("previous");
  var Ls = (e) => {
    let t = e, n = t.next();
    if (!n.done) for (n.value[cn] = t, n = (t = n.value).next(); ; ) if (n.done) {
      if (t === e) break;
      t = t[cn], n = t.next(n.value);
    } else n.value[cn] = t, n = (t = n.value).next();
    return n.value;
  };
  var an = E("_literal");
  var m = (e, t) => {
    const n = Ft(t);
    return n[an] = e, n;
  };
  var $s = new ae();
  var Li = le.bind($s);
  var As = ye.bind($s);
  var $i = false;
  var Ai = true;
  var Fs = new ae();
  var Fi = le.bind(Fs);
  var Ds = ye.bind(Fs);
  var vs = (e) => {
    const t = [];
    return Li(t), e && Fi(t), t;
  };
  var it = Date;
  var Di = Date.parse;
  var vi = Object.preventExtensions;
  var Ci = Object.getOwnPropertyDescriptors;
  var Ni = (function(t, n) {
    for (var s = v(A), r = Xn(n), o2 = r.length, i = 0; i < o2; ++i) {
      var c = r[i];
      s[c] = Un(n[c]);
    }
    if (Ze) {
      var u = Ze(n);
      for (o2 = u.length, i = 0; i < o2; ++i) {
        var d2 = u[i];
        Bn(n, d2) && (s[d2] = Un(n[d2]));
      }
    }
    return Dr(t, s);
  });
  var ot = (e) => ($($(e).prototype), e);
  var Mi = /(?:0[1-9]|1\d|2\d)/;
  var Cs = /(?:0[1-9]|[12]\d|30)/;
  var Ns = /(?:0[1-9]|[12]\d|3[01])/;
  var Ms = /(?:[01]\d|2[0-3])/;
  var ln = /[0-5]\d/;
  var ct = T`
	\d\d\d\d-
	(?:
		0
		(?:
			[13578]-${Ns}
			|
			[469]-${Cs}
			|
			2-${Mi}
		)
		|
		1
		(?:
			[02]-${Ns}
			|
			1-${Cs}
		)
	)
`.valueOf();
  var at = T`
	${Ms}:${ln}:${ln}
`.valueOf();
  var Bi = /(?:[Zz]|[+-]\d\d:\d\d)$/;
  var { exec: ki } = _(/(([+-])\d\d):(\d\d)$/);
  var { exec: Ui } = T`
	^
	${ct}
	[Tt ]
	${at}
	(?:\.\d{1,3}(\d*?)0*)?
	(?:[Zz]|[+-]${Ms}:${ln})
	$`.valueOf();
  var { exec: Pi } = T`
	^
	${ct}
	[Tt ]
	${at}
	()
	[Zz]
	$`.valueOf();
  var { test: ji } = T`
	^
	${ct}
	[Tt ]
	${at}
	(?:\.\d+)?
	$`.valueOf();
  var { test: Wi } = T`
	^
	${ct}
	$`.valueOf();
  var { test: Gi } = T`
	^
	${at}
	(?:\.\d+)?
	$`.valueOf();
  var Bs = /[ t]/;
  var Yi = /[-T:.]/g;
  var ks = /\.?0+$/;
  var Hi = /\.(\d*?)0+$/;
  var Zi = (e, t) => t;
  var lt = (() => {
    const e = function() {
      return this;
    }, t = C(null);
    {
      const n = C(null);
      for (const s of qn(it.prototype)) s === "constructor" || s === "toJSON" || (t[s] = n);
    }
    return e.prototype = vi(v(it.prototype, t)), $(e);
  })();
  var se = (e) => e.replace(Hi, Zi).replace(Yi, "");
  var Us = /./gs;
  var Ps = (e) => "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009"[e];
  var zi = (e, t) => e < 0 ? ("" + (e + 6216730554e4)).replace(Us, Ps).padStart(14, "\u2000") + t.replace(Us, Ps) + e : t ? (e + ".").padStart(16, "0") + t : ("" + e).padStart(15, "0");
  var un = (e) => {
    if (e.startsWith("02-29", 5)) {
      const t = +e.slice(0, 4);
      return t & 3 ? false : t % 100 ? true : t % 400 ? false : !!(t % 3200);
    }
    return true;
  };
  var { test: Xi } = T.s`^.....(?:06.30|12.31).23:59:59`.valueOf();
  var ut = Ni(new it(0), Ci(it.prototype));
  var ft = E("OffsetDateTime_ISOString");
  var Pe = E("OffsetDateTime_value");
  var re = (e, t = 0) => (ut.setTime(+e[Pe] + t), ut);
  var _a, _b;
  var ht = ot(class extends lt {
    constructor(t) {
      un(t) || a(f(`Invalid Offset Date-Time ${t}` + l(" at ")));
      const n = t.startsWith("60", 17);
      let s = n ? t.slice(0, 17) + "59" + t.slice(19) : t;
      const { 1: r = "" } = (te ? Pi(s) : Ui(s)) || a(f(`Invalid Offset Date-Time ${t}` + l(" at "))), o2 = Di(s = s.replace(Bs, "T").replace("z", "Z"));
      n && (ut.setTime(o2), Xi(ut.toISOString()) || a(f(`Invalid Offset Date-Time ${t}` + l(" at "))));
      super();
      __publicField(this, _b);
      __publicField(this, _a);
      return this[ft] = s, this[Pe] = zi(o2, r), this;
    }
    get [(_b = ft, _a = Pe, E.toStringTag)]() {
      return "OffsetDateTime";
    }
    valueOf() {
      return this[Pe];
    }
    toISOString() {
      return this[ft];
    }
    getUTCFullYear() {
      return re(this).getUTCFullYear();
    }
    getUTCMonth() {
      return re(this).getUTCMonth();
    }
    getUTCDate() {
      return re(this).getUTCDate();
    }
    getUTCHours() {
      return re(this).getUTCHours();
    }
    getUTCMinutes() {
      return re(this).getUTCMinutes();
    }
    getUTCSeconds() {
      return re(this).getUTCSeconds();
    }
    getUTCMilliseconds() {
      return re(this).getUTCMilliseconds();
    }
    getUTCDay() {
      return re(this).getUTCDay();
    }
    getTimezoneOffset() {
      const t = ki(this[ft]);
      return t ? +t[1] * 60 + +(t[2] + t[3]) : 0;
    }
    getTime() {
      return mr(+this[Pe]);
    }
  });
  var K = E("LocalDateTime_ISOString");
  var Oe = E("LocalDateTime_value");
  var Se = (e, t, n) => +e[K].slice(t, n);
  var Le = (e, t, n, s) => {
    const r = "" + s, o2 = n - t;
    if (r.length > o2) throw b();
    e[Oe] = se(e[K] = e[K].slice(0, t) + r.padStart(o2, "0") + e[K].slice(n));
  };
  var _a2, _b2;
  var dt = ot(class extends lt {
    constructor(t) {
      ji(t) && un(t) || a(f(`Invalid Local Date-Time ${t}` + l(" at ")));
      super();
      __publicField(this, _b2);
      __publicField(this, _a2);
      return this[Oe] = se(this[K] = t.replace(Bs, "T")), this;
    }
    get [(_b2 = K, _a2 = Oe, E.toStringTag)]() {
      return "LocalDateTime";
    }
    valueOf() {
      return this[Oe];
    }
    toISOString() {
      return this[K];
    }
    getFullYear() {
      return Se(this, 0, 4);
    }
    setFullYear(t) {
      Le(this, 0, 4, t);
    }
    getMonth() {
      return Se(this, 5, 7) - 1;
    }
    setMonth(t) {
      Le(this, 5, 7, t + 1);
    }
    getDate() {
      return Se(this, 8, 10);
    }
    setDate(t) {
      Le(this, 8, 10, t);
    }
    getHours() {
      return Se(this, 11, 13);
    }
    setHours(t) {
      Le(this, 11, 13, t);
    }
    getMinutes() {
      return Se(this, 14, 16);
    }
    setMinutes(t) {
      Le(this, 14, 16, t);
    }
    getSeconds() {
      return Se(this, 17, 19);
    }
    setSeconds(t) {
      Le(this, 17, 19, t);
    }
    getMilliseconds() {
      return +this[Oe].slice(14, 17).padEnd(3, "0");
    }
    setMilliseconds(t) {
      this[Oe] = se(this[K] = this[K].slice(0, 19) + (t ? ("." + ("" + t).padStart(3, "0")).replace(ks, "") : ""));
    }
  });
  var ge = E("LocalDate_ISOString");
  var pt = E("LocalDate_value");
  var fn = (e, t, n) => +e[ge].slice(t, n);
  var hn = (e, t, n, s) => {
    const r = "" + s, o2 = n - t;
    if (r.length > o2) throw b();
    e[pt] = se(e[ge] = e[ge].slice(0, t) + r.padStart(o2, "0") + e[ge].slice(n));
  };
  var _a3, _b3;
  var gt = ot(class extends lt {
    constructor(t) {
      Wi(t) && un(t) || a(f(`Invalid Local Date ${t}` + l(" at ")));
      super();
      __publicField(this, _b3);
      __publicField(this, _a3);
      return this[pt] = se(this[ge] = t), this;
    }
    get [(_b3 = ge, _a3 = pt, E.toStringTag)]() {
      return "LocalDate";
    }
    valueOf() {
      return this[pt];
    }
    toISOString() {
      return this[ge];
    }
    getFullYear() {
      return fn(this, 0, 4);
    }
    setFullYear(t) {
      hn(this, 0, 4, t);
    }
    getMonth() {
      return fn(this, 5, 7) - 1;
    }
    setMonth(t) {
      hn(this, 5, 7, t + 1);
    }
    getDate() {
      return fn(this, 8, 10);
    }
    setDate(t) {
      hn(this, 8, 10, t);
    }
  });
  var q = E("LocalTime_ISOString");
  var $e = E("LocalTime_value");
  var dn = (e, t, n) => +e[q].slice(t, n);
  var pn = (e, t, n, s) => {
    const r = "" + s, o2 = n - t;
    if (r.length > o2) throw b();
    e[$e] = se(e[q] = e[q].slice(0, t) + r.padStart(2, "0") + e[q].slice(n));
  };
  var _a4, _b4;
  var _t = ot(class extends lt {
    constructor(t) {
      Gi(t) || a(f(`Invalid Local Time ${t}` + l(" at ")));
      super();
      __publicField(this, _b4);
      __publicField(this, _a4);
      return this[$e] = se(this[q] = t), this;
    }
    get [(_b4 = q, _a4 = $e, E.toStringTag)]() {
      return "LocalTime";
    }
    valueOf() {
      return this[$e];
    }
    toISOString() {
      return this[q];
    }
    getHours() {
      return dn(this, 0, 2);
    }
    setHours(t) {
      pn(this, 0, 2, t);
    }
    getMinutes() {
      return dn(this, 3, 5);
    }
    setMinutes(t) {
      pn(this, 3, 5, t);
    }
    getSeconds() {
      return dn(this, 6, 8);
    }
    setSeconds(t) {
      pn(this, 6, 8, t);
    }
    getMilliseconds() {
      return +this[$e].slice(6, 9).padEnd(3, "0");
    }
    setMilliseconds(t) {
      this[$e] = se(this[q] = this[q].slice(0, 8) + (t ? ("." + ("" + t).padStart(3, "0")).replace(ks, "") : ""));
    }
  });
  var Ae = parseInt;
  var js = String.fromCodePoint;
  var Ki = /[^\\]+|\\(?:[\\"btnfr/]|u.{4}|U.{8})/gs;
  var qi = /[^\n\\]+|\n|\\(?:[\t ]*\n[\t\n ]*|[\\"btnfr/]|u.{4}|U.{8})/gs;
  var gn = (e) => {
    if (!e) return "";
    const t = e.match(Ki), { length: n } = t;
    let s = 0;
    do {
      const r = t[s];
      if (r[0] === "\\") switch (r[1]) {
        case "\\":
          t[s] = "\\";
          break;
        case '"':
          t[s] = '"';
          break;
        case "b":
          t[s] = "\b";
          break;
        case "t":
          t[s] = "	";
          break;
        case "n":
          t[s] = `
`;
          break;
        case "f":
          t[s] = "\f";
          break;
        case "r":
          t[s] = "\r";
          break;
        case "u":
          const o2 = Ae(r.slice(2), 16);
          P && 55295 < o2 && o2 < 57344 && a(b(`Invalid Unicode Scalar ${r}` + l(" at "))), t[s] = Dt(o2);
          break;
        case "U":
          const i = Ae(r.slice(2), 16);
          (P && 55295 < i && i < 57344 || 1114111 < i) && a(b(`Invalid Unicode Scalar ${r}` + l(" at "))), t[s] = js(i);
          break;
        case "/":
          t[s] = "/";
          break;
      }
    } while (++s !== n);
    return t.join("");
  };
  var Ws = (e, t, n) => {
    if (!e) return "";
    const s = e.match(qi), { length: r } = s;
    let o2 = 0;
    do {
      const i = s[o2];
      if (i === `
`) ++n, s[o2] = t;
      else if (i[0] === "\\") switch (i[1]) {
        case `
`:
        case " ":
        case "	":
          for (let d2 = 0; d2 = i.indexOf(`
`, d2) + 1; ) ++n;
          s[o2] = "";
          break;
        case "\\":
          s[o2] = "\\";
          break;
        case '"':
          s[o2] = '"';
          break;
        case "b":
          s[o2] = "\b";
          break;
        case "t":
          s[o2] = "	";
          break;
        case "n":
          s[o2] = `
`;
          break;
        case "f":
          s[o2] = "\f";
          break;
        case "r":
          s[o2] = "\r";
          break;
        case "u":
          const c = Ae(i.slice(2), 16);
          P && 55295 < c && c < 57344 && a(b(`Invalid Unicode Scalar ${i}` + l(" at ", X + n))), s[o2] = Dt(c);
          break;
        case "U":
          const u = Ae(i.slice(2), 16);
          (P && 55295 < u && u < 57344 || 1114111 < u) && a(b(`Invalid Unicode Scalar ${i}` + l(" at ", X + n))), s[o2] = js(u);
          break;
        case "/":
          s[o2] = "/";
          break;
      }
    } while (++o2 !== r);
    return s.join("");
  };
  var Gs = /[-+]?(?:0|[1-9][_\d]*)/;
  var { test: Vi } = T`_(?!\d)`.valueOf();
  var { test: Ri } = T`^${Gs}$`.valueOf();
  var { test: Qi } = _(/^0(?:x[\dA-Fa-f][_\dA-Fa-f]*|o[0-7][_0-7]*|b[01][_01]*)$/);
  var { test: Ji } = T`_(?![\dA-Fa-f])`.valueOf();
  var Ys = /_/g;
  var Tt = /_|^[-+]/g;
  var _n = (e) => (Ri(e) || Qi(e)) && !Ji(e);
  var Hs = Y && -Y("0x8000000000000000");
  var Zs = Y && Y("0x7FFFFFFFFFFFFFFF");
  var eo = (e) => {
    _n(e) || a(f(`Invalid Integer ${e}` + l(" at ")));
    const t = e[0] === "-" ? -Y(e.replace(Tt, "")) : Y(e.replace(Tt, ""));
    return tt || Hs <= t && t <= Zs || a(b(`Integer expect 64 bit range (-9,223,372,036,854,775,808 to 9,223,372,036,854,775,807), not includes ${e}` + l(" meet at "))), t;
  };
  var to = (e) => {
    _n(e) || a(f(`Invalid Integer ${e}` + l(" at ")));
    const t = Ae(e.replace(Ys, ""));
    return _e(t) || a(b(`Integer did not use BitInt must fit Number.isSafeInteger, not includes ${e}` + l(" meet at "))), t;
  };
  var wt = (e) => {
    if (Ie === true) return eo(e);
    if (Ie === false) return to(e);
    _n(e) || a(f(`Invalid Integer ${e}` + l(" at ")));
    const t = Ae(e.replace(Ys, ""));
    if (Ht <= t && t <= Zt) return t;
    const n = e[0] === "-" ? -Y(e.replace(Tt, "")) : Y(e.replace(Tt, ""));
    return tt || Hs <= n && n <= Zs || a(b(`Integer expect 64 bit range (-9,223,372,036,854,775,808 to 9,223,372,036,854,775,807), not includes ${e}` + l(" meet at "))), n;
  };
  var no = isFinite;
  var bt = NaN;
  var so = -bt;
  var zs = -we;
  var { test: ro } = T`
	^
	${Gs}
	(?:
		\.\d[_\d]*
		(?:[eE][-+]?\d[_\d]*)?
	|
		[eE][-+]?\d[_\d]*
	)
	$`.valueOf();
  var io = /_/g;
  var { test: oo } = _(/^[-+]?0(?:\.0+)?(?:[eE][-+]?0+)?$/);
  var { exec: co } = _(/^[-0]?(\d*)(?:\.(\d+))?(?:e\+?(-?\d+))?$/);
  var { exec: ao } = _(/^[-+]?0?(\d*)(?:\.(\d*?)0*)?(?:[eE]\+?(-?\d+))?$/);
  var yt = (e) => {
    if (!ro(e) || Vi(e)) {
      if (de) {
        if (e === "inf" || e === "+inf") return we;
        if (e === "-inf") return zs;
        if (e === "nan" || e === "+nan") return bt;
        if (e === "-nan") return so;
      } else if (!et) {
        if (e === "inf" || e === "+inf") return we;
        if (e === "-inf") return zs;
      }
      throw a(f(`Invalid Float ${e}` + l(" at ")));
    }
    const t = e.replace(io, ""), n = +t;
    if (et) {
      no(n) || a(b(`Float ${e} has been as big as inf` + l(" at "))), n || oo(t) || a(b(`Float ${e} has been as little as ${e[0] === "-" ? "-" : ""}0` + l(" at ")));
      const { 1: s, 2: r = "", 3: o2 = "" } = co(n), { 1: i, 2: c = "", 3: u = "" } = ao(t);
      i + c === s + r && u - c.length === o2 - r.length || a(b(`Float ${e} has lost its exact and been ${n}` + l(" at ")));
    }
    return n;
  };
  var lo = (e, t) => {
    const { length: n } = t;
    let s = 0;
    for (; s < n; ) {
      const r = t[s++];
      if (r in e) if (e = e[r], cs(e)) Ke(e) && a(I("Trying to define Table under Inline Table" + l(" at ")));
      else if (As(e)) Ds(e) && a(I("Trying to append value to Static Array" + l(" at "))), e = e[e.length - 1];
      else throw a(I("Trying to define Table under non-Table value" + l(" at ")));
      else {
        for (e = e[r] = new j(Ve); s < n; ) e = e[t[s++]] = new j(Ve);
        return e;
      }
    }
    return e;
  };
  var uo = (e, t, n, s) => {
    let r;
    if (n) {
      let o2;
      t in e ? As(o2 = e[t]) && !Ds(o2) || a(I("Trying to push Table to non-ArrayOfTables value" + l(" at "))) : o2 = e[t] = vs($i), s && pe(s, o2, e, t), o2[o2.length] = r = new j(Bt);
    } else t in e ? (r = e[t], hs(r) && a(I("A table defined implicitly via key/value pair can not be accessed to via []" + l(", which at "))), Hr(r) || a(I("Duplicate Table definition" + l(" at ")))) : e[t] = r = new j(Bt), s && pe(s, null, e, t);
    return r;
  };
  var fo = (e, t) => {
    const { length: n } = t;
    let s = 0;
    for (; s < n; ) {
      const r = t[s++];
      if (r in e) e = e[r], cs(e) || a(I("Trying to assign property through non-Table value" + l(" at "))), Ke(e) && a(I("Trying to assign property through static Inline Table" + l(" at "))), hs(e) || a(I("A table defined implicitly via [] can not be accessed to via key/value pair" + l(", which at ")));
      else {
        for (e = e[r] = new j(Ve, ds); s < n; ) e = e[t[s++]] = new j(Ve, ds);
        return e;
      }
    }
    return e;
  };
  var Fe = (e) => (xe(e) && a(f("Control characters other than Tab are not permitted in a Literal String" + l(", which was found at "))), e);
  var Xs = ((e, t, n) => {
    if (!n.startsWith("'''")) {
      const i = Rr(n) || a(f("Bad literal string" + l(" at "))), c = Fe(i[1]);
      return e[t] = F ? m(n.slice(0, c.length + 2), c) : c, i[2];
    }
    const s = ue(n.slice(3));
    if (s) {
      const i = Fe(s[1]) + s[2];
      return e[t] = F ? m(n.slice(0, i.length + 6), i) : i, s[3];
    }
    const r = new Qe("Multi-line Literal String", n.length), o2 = !(n = n.slice(3));
    if (o2) {
      n = r.must();
      const i = ue(n);
      if (i) {
        const c = Fe(i[1]) + i[2];
        return e[t] = F ? m(["'''", n.slice(0, c.length + 3)], c) : c, i[3];
      }
    }
    ee === null && r.nowrap(y);
    for (const i = [Fe(n)]; ; ) {
      const c = r.must(), u = ue(c);
      if (u) {
        i[i.length] = Fe(u[1]) + u[2];
        const d2 = i.join(ee);
        return F ? (i[i.length - 1] += "'''", o2 ? i.unshift("'''") : i[0] = `'''${n}`, e[t] = m(i, d2)) : e[t] = d2, u[3];
      }
      i[i.length] = Fe(c);
    }
  });
  var Ks = ((e, t, n) => {
    if (!n.startsWith('"""')) {
      const i = bs(n), c = gn(n.slice(1, i));
      return e[t] = F ? m(n.slice(0, i + 1), c) : c, n.slice(i + 1).replace(L, "");
    }
    let s = 3 + jt(n.slice(3));
    if (n.length !== s) {
      const i = n.slice(3, s);
      Ce(i) || a(f("Bad multi-line basic string" + l(" at ")));
      const c = gn(i) + (n.startsWith('"', s += 3) ? n.startsWith('"', ++s) ? (++s, '""') : '"' : "");
      return e[t] = F ? m(n.slice(0, s), c) : c, n.slice(s).replace(L, "");
    }
    const r = new Qe("Multi-line Basic String", s), o2 = (n = n.slice(3)) ? 0 : 1;
    if (o2) {
      n = r.must();
      let i = jt(n);
      if (n.length !== i) {
        const c = n.slice(0, i);
        Ce(c) || a(f("Bad multi-line basic string" + l(" at ")));
        const u = Ws(c, ee, o2) + (n.startsWith('"', i += 3) ? n.startsWith('"', ++i) ? (++i, '""') : '"' : "");
        return e[t] = F ? m(['"""', n.slice(0, i)], u) : u, n.slice(i).replace(L, "");
      }
    }
    ee === null && r.nowrap(y), Ce(n + `
`) || a(f("Bad multi-line basic string" + l(" at ")));
    for (const i = [n]; ; ) {
      const c = r.must();
      let u = jt(c);
      if (c.length !== u) {
        const d2 = c.slice(0, u);
        Ce(d2) || a(f("Bad multi-line basic string" + l(" at ")));
        const g2 = Ws(i.join(`
`) + `
` + d2, ee, o2) + (c.startsWith('"', u += 3) ? c.startsWith('"', ++u) ? (++u, '""') : '"' : "");
        return F ? (o2 ? i.unshift('"""') : i[0] = `"""${n}`, i[i.length] = `${d2}"""`, e[t] = m(i, g2)) : e[t] = g2, c.slice(u).replace(L, "");
      }
      Ce(c + `
`) || a(f("Bad multi-line basic string" + l(" at "))), i[i.length] = c;
    }
  });
  var mt = C(null);
  var je = (e) => mt[e] || (mt[e] = E(e));
  var De = E("this");
  var { test: ho } = _(/\r?\n/g);
  var xt = (e, t) => {
    if (t in e) {
      const n = e[t];
      if (typeof n != "string") throw h(`the value of comment must be a string, while "${n === null ? "null" : typeof n}" type is found`);
      if (ho(n)) throw f("the value of comment must be a string and can not include newline");
      return ` #${n}`;
    }
    return "";
  };
  var We = (e, t) => t in mt ? xt(e, mt[t]) : "";
  var { test: qs } = _(Bi);
  var { test: po } = _(/^\[[\t ]*]/);
  var Vs = (e) => {
    let t = e;
    const n = [];
    let s = -1;
    for (; ; ) {
      if (t || a(f("Empty bare key" + l(" at "))), t[0] === '"') {
        const o2 = bs(t);
        ke.test(n[++s] = gn(t.slice(1, o2))) || a(I("Key not allowed" + l(" at "))), t = t.slice(o2 + 1);
      } else {
        const o2 = t[0] === "'", i = ((o2 ? Me : Ne)(t) || a(f(`Bad ${o2 ? "literal string" : "bare"} key` + l(" at "))))[0];
        t = t.slice(i.length), ke.test(n[++s] = o2 ? i.slice(1, -1) : i) || a(I("Key not allowed" + l(" at ")));
      }
      if (ai(t)) t = t.replace(li, "");
      else break;
    }
    if (Os) {
      const o2 = e.slice(0, -t.length);
      (Es(o2) || Ue && o2 === "null") && a(f("Bad bare key disabled by xOptions.string" + l(" at ")));
    }
    if (he) {
      let o2 = s;
      do
        n[o2] || a(f("Empty key is not allowed before TOML v0.5" + l(", which at ")));
      while (o2--);
    }
    const r = n[s];
    return n.length = s, { leadingKeys: n, finalKey: r, lineRest: t };
  };
  var go = (e, t) => {
    if (t[0] === "<") {
      const { 1: s } = { 2: t } = ei(t) || a(f("Bad tag " + l(" at ")));
      switch (pe(s, e, null), t && t[0]) {
        case ",":
        case "]":
        case "":
        case "#":
          return e[e.length] = S, t;
      }
    }
    switch (t[0]) {
      case "'":
        return Xs(st(e), e.length, t);
      case '"':
        return Ks(st(e), e.length, t);
      case "{":
        return ne || a(f("Inline Table is not allowed before TOML v0.4" + l(", which at "))), Qs(Vt(e), e.length, t);
      case "[":
        return Rs(Rt(e), e.length, t);
    }
    const { 1: n } = { 2: t } = gs(t) || a(f("Bad atom value" + l(" at ")));
    return n === "true" ? rt(e)[e.length] = true : n === "false" ? rt(e)[e.length] = false : Ue && n === "null" ? qt(e)[e.length] = null : n.includes(":") ? n.includes("-") ? qs(n) ? en(e)[e.length] = new ht(n) : (N || a(f("Local Date-Time is not allowed before TOML v0.5" + l(", which at "))), tn(e)[e.length] = new dt(n)) : (N || a(f("Local Time is not allowed before TOML v0.5" + l(", which at "))), sn(e)[e.length] = new _t(n)) : n.indexOf("-") !== n.lastIndexOf("-") && n[0] !== "-" ? (N || a(f("Local Date is not allowed before TOML v0.5" + l(", which at "))), nn(e)[e.length] = new gt(n)) : n.includes(".") || n.includes("n") || (n.includes("e") || n.includes("E")) && !n.startsWith("0x") ? Qt(e)[e.length] = F ? m(n, yt(n)) : yt(n) : Jt(e)[e.length] = F ? m(n, wt(n)) : wt(n), t;
  };
  var Rs = function* (e, t, n) {
    const s = e[t] = vs(Ai);
    if (po(n)) return Z(s, n[1] === "]" ? 0 : 3), n.slice(n.indexOf("]")).replace(U, "");
    const r = new Qe("Static Array", n.length);
    let o2 = n.startsWith("[ ") || n.startsWith("[	") ? 3 : 0;
    for (n = n.replace(U, ""); !n || n[0] === "#"; ) o2 = null, n = r.must().replace(L, "");
    if (n[0] === "]") return o2 === null || Z(s, o2), n.replace(U, "");
    for (; ; ) {
      const i = go(s, n);
      for (n = typeof i == "string" ? i : yield i; !n || n[0] === "#"; ) o2 = null, n = r.must().replace(L, "");
      if (n[0] === ",") {
        for (n = n.replace(U, ""); !n || n[0] === "#"; ) o2 = null, n = r.must().replace(L, "");
        if (n[0] === "]") break;
      } else {
        if (n[0] === "]") break;
        throw a(f("Unexpect character in static array item value" + l(", which is found at ")));
      }
    }
    return o2 === null || Z(s, o2), n.replace(U, "");
  };
  var Qs = function* (e, t, n) {
    const s = e[t] = new j(Bt, Gr);
    if (Kt) {
      const r = new Qe("Inline Table", n.length);
      n = n.replace(U, "");
      let o2 = true;
      for (; ; ) {
        for (; !n || n[0] === "#"; ) o2 = false, n = r.must().replace(L, "");
        if (n[0] === "}") break;
        const i = Tn(s, n), c = wn(i);
        if (n = typeof c == "string" ? c : yield c, n) {
          if (n[0] === "#") {
            nt && (i.table[je(i.finalKey)] = n.slice(1)), o2 = false;
            do
              n = r.must().replace(L, "");
            while (!n || n[0] === "#");
          }
        } else {
          o2 = false;
          do
            n = r.must().replace(L, "");
          while (!n || n[0] === "#");
        }
        n[0] === "," && (n = n.replace(U, ""));
      }
      o2 || Z(s, false);
    } else if (n = n.replace(U, "") || a(f("Inline Table is intended to appear on a single line" + l(", which broken at "))), n[0] !== "}") for (; ; ) {
      n[0] === "#" && a(f("Inline Table is intended to appear on a single line" + l(", which broken at ")));
      const r = wn(Tn(s, n));
      if (n = (typeof r == "string" ? r : yield r) || a(f("Inline Table is intended to appear on a single line" + l(", which broken at "))), n[0] === "}") break;
      n[0] === "," && (n = n.replace(U, "") || a(f("Inline Table is intended to appear on a single line" + l(", which broken at "))), n[0] === "}" && a(f("The last property of an Inline Table can not have a trailing comma" + l(", which was found at "))));
    }
    return n.replace(U, "");
  };
  var Tn = (e, t) => {
    const { leadingKeys: n, finalKey: s, tag: r } = { lineRest: t } = fi(Vs(t));
    return { table: fo(e, n), finalKey: s, tag: r, lineRest: t };
  };
  var wn = ({ finalKey: e, tag: t, lineRest: n, table: s }) => {
    if (e in s && a(I("Duplicate property definition" + l(" at "))), t) switch (pe(t, null, s, e), n && n[0]) {
      case ",":
      case "}":
      case "":
      case "#":
        return s[e] = S, n;
    }
    switch (n && n[0]) {
      case "'":
        return Xs(s, e, n);
      case '"':
        return Ks(s, e, n);
      case "{":
        return ne || a(f("Inline Table is not allowed before TOML v0.4" + l(", which at "))), Qs(s, e, n);
      case "[":
        return Rs(s, e, n);
    }
    const { 1: r } = { 2: n } = gs(n) || a(f("Bad atom value" + l(" at ")));
    return r === "true" ? s[e] = true : r === "false" ? s[e] = false : Ue && r === "null" ? s[e] = null : r.includes(":") ? r.includes("-") ? qs(r) ? s[e] = new ht(r) : (N || a(f("Local Date-Time is not allowed before TOML v0.5" + l(", which at "))), s[e] = new dt(r)) : (N || a(f("Local Time is not allowed before TOML v0.5" + l(", which at "))), s[e] = new _t(r)) : r.indexOf("-") !== r.lastIndexOf("-") && r[0] !== "-" ? (N || a(f("Local Date is not allowed before TOML v0.5" + l(", which at "))), s[e] = new gt(r)) : s[e] = r.includes(".") || r.includes("n") || (r.includes("e") || r.includes("E")) && !r.startsWith("0x") ? F ? m(r, yt(r)) : yt(r) : F ? m(r, wt(r)) : wt(r), n;
  };
  var _o = () => {
    const e = new j();
    let t = e;
    for (; qr(); ) {
      const n = Kr().replace(L, "");
      if (n) if (n[0] === "[") {
        const { leadingKeys: s, finalKey: r, asArrayItem: o2, tag: i, lineRest: c } = ui(n, Vs), u = lo(e, s);
        c && (c[0] === "#" || a(f("Unexpect charachtor after table header" + l(" at ")))), t = uo(u, r, o2, i), nt && c && (t[De] = o2 ? c.slice(1) : u[je(r)] = c.slice(1));
      } else if (n[0] === "#") xe(n) && a(f("Control characters other than Tab are not permitted in comments" + l(", which was found at ")));
      else {
        const s = Tn(t, n);
        let r = wn(s);
        typeof r == "string" || (r = Ls(r)), r && (r[0] === "#" || a(f("Unexpect charachtor after key/value pair" + l(" at "))), nt && (s.table[je(s.finalKey)] = r.slice(1)));
      }
    }
    return e;
  };
  var To = Number.MAX_SAFE_INTEGER;
  var wo = Date.prototype;
  var Js = String.prototype.valueOf;
  var bo = (function() {
    if (Q.bind) {
      var e = Q.bind(Js);
      return function(n) {
        try {
          e(n);
        } catch {
          return false;
        }
        return true;
      };
    }
    return function(n) {
      try {
        Js.apply(n);
      } catch {
        return false;
      }
      return true;
    };
  })();
  var er = Number.prototype.valueOf;
  var yo = (function() {
    if (Q.bind) {
      var e = Q.bind(er);
      return function(n) {
        try {
          e(n);
        } catch {
          return false;
        }
        return true;
      };
    }
    return function(n) {
      try {
        er.apply(n);
      } catch {
        return false;
      }
      return true;
    };
  })();
  var mo = (function() {
    if (typeof BigInt == "function") {
      var e = Q.bind(BigInt.prototype.valueOf);
      return function(n) {
        try {
          e(n);
        } catch {
          return false;
        }
        return true;
      };
    }
    return function() {
      return false;
    };
  })();
  var tr = BigInt.prototype.valueOf;
  var xo = (function() {
    if (Q.bind) {
      var e = Q.bind(tr);
      return function(n) {
        try {
          e(n);
        } catch {
          return false;
        }
        return true;
      };
    }
    return function(n) {
      try {
        tr.apply(n);
      } catch {
        return false;
      }
      return true;
    };
  })();
  var bn = C({ ...vr([...Ye(32)].map((e, t) => [Dt(t), "\\u" + t.toString(16).toUpperCase().padStart(4, "0")])), "\b": "\\b", "	": "\\t", "\n": "\\n", "\f": "\\f", "\r": "\\r", '"': '\\"', '"""': '""\\"', "\\": "\\\\", "\x7F": "\\u007F" });
  var { test: Io } = _(/[\x00-\x08\x0A-\x1F'\x7F]/);
  var nr = /[^\x00-\x08\x0A-\x1F"\\\x7F]+|./gs;
  var { test: sr } = _(/^[\x00-\x08\x0A-\x1F"\\\x7F]/);
  var rr = (e) => {
    if (Io(e)) {
      const t = e.match(nr);
      let n = t.length;
      do
        sr(t[--n]) && (t[n] = bn[t[n]]);
      while (n);
      return `"${t.join("")}"`;
    }
    return `'${e}'`;
  };
  var Eo = (e) => {
    if (e) {
      const t = e.match(nr);
      let n = t.length;
      do
        sr(t[--n]) && (t[n] = bn[t[n]]);
      while (n);
      return `"${t.join("")}"`;
    }
    return '""';
  };
  var { test: Oo } = _(/[\x00-\x08\x0A-\x1F\x7F]|'''/);
  var { test: So } = _(/[\x00-\x08\x0B-\x1F\x7F]|'''/);
  var { test: Lo } = _(/[\x00-\x08\x0A-\x1F\\\x7F]|"""/);
  var $o = /[^\x00-\x08\x0A-\x1F"\\\x7F]+|"""|./gs;
  var { test: Ao } = _(/^(?:[\x00-\x08\x0A-\x1F\\\x7F]|""")/);
  var It = (e, t) => {
    const n = e[t];
    if (Lo(n)) {
      const s = n.match($o);
      let r = s.length;
      do
        Ao(s[--r]) && (s[r] = bn[s[r]]);
      while (r);
      e[t] = s.join("");
    }
  };
  var ir = (e) => (e = ["", ...e]).length === 1 ? ["", ""] : e;
  var Fo = (e) => {
    const t = e.length - 1;
    let n = t;
    do
      if (Oo(e[n])) break;
    while (--n);
    if (n) for (n = t, It(e, n), e[n] += e[0] = '"""'; --n; ) It(e, n);
    else e[t] += e[0] = "'''";
    return e;
  };
  var yn = (e) => {
    let t = e.length - 1;
    for (It(e, t), e[t] += e[0] = '"""'; --t; ) It(e, t);
    return e;
  };
  var Do = (e) => (e[e.length - 1] += e[0] = "'''", e);
  var or = Float64Array;
  var cr = Uint8Array;
  var ar = -we;
  var { test: vo } = _(/^-?\d+$/);
  var lr = (e) => vo(e) ? e + ".0" : e;
  var ur = new or([bt]);
  var fr = new cr(ur.buffer);
  var hr = fr[7];
  var Co = hr === new cr(new or([-bt]).buffer)[7] ? (e) => e ? e === we ? "inf" : e === ar ? "-inf" : lr("" + e) : e === e ? Ct(e, 0) ? "0.0" : "-0.0" : "nan" : (e) => e ? e === we ? "inf" : e === ar ? "-inf" : lr("" + e) : e === e ? Ct(e, 0) ? "0.0" : "-0.0" : (ur[0] = e, fr[7] === hr ? "nan" : "-nan");
  var No = Fn.bind(wo);
  var { test: Mo } = _(/^[\w-]+$/);
  var mn = (e) => Mo(e) ? e : rr(e);
  var Bo = /[^.]+/;
  var ko = (e) => `'${e}'`;
  var xn = (e) => Es(e) ? e.replace(Bo, ko) : e === "null" ? "'null'" : e;
  var dr = class extends Ye {
    constructor(t) {
      super();
      __publicField(this, "document");
      return this.document = t, this;
    }
    [E.toPrimitive]() {
      return this.join(this.document.newline);
    }
    appendNewline() {
      this[this.length] = "";
    }
    set appendLine(t) {
      this[this.length] = t;
    }
    set appendInline(t) {
      this[this.length - 1] += t;
    }
    set appendInlineIf(t) {
      t && (this[this.length - 1] += t);
    }
    *assignBlock(t, n, s, r) {
      const { document: o2 } = this, { newlineUnderHeader: i, newlineUnderSectionButPair: c } = o2, u = n ? o2.newlineUnderPairButDotted : false, d2 = n ? o2.newlineUnderDotted : o2.newlineUnderPair;
      for (const g2 of r) {
        const p = s[g2], x = mn(g2), w2 = t + x;
        if (ce(p)) {
          const { length: O } = p;
          if (O) {
            let G3 = p[0];
            if (me(G3)) {
              const Ge = `[[${w2}]]`, On = w2 + ".";
              let Sn = 0, ie3 = G3;
              for (; ; ) {
                const oe3 = o2.appendSection();
                if (oe3[0] = Ge + xt(ie3, De), i ? (oe3[1] = "", yield oe3.assignBlock(On, "", ie3, H(ie3)), c && oe3.length !== 2 && oe3.appendNewline()) : (yield oe3.assignBlock(On, "", ie3, H(ie3)), c && oe3.appendNewline()), ++Sn === O) break;
                if (ie3 = p[Sn], !me(ie3)) throw h("the first table item marked by Section() means the parent array is an array of tables, which can not include other types or table not marked by Section() any more in the rest items");
              }
              continue;
            } else {
              let Ge = 1;
              for (; Ge !== O; ) if (me(p[Ge++])) throw h("if an array is not array of tables, it can not include any table that marked by Section()");
            }
          }
        } else if (me(p)) {
          const O = o2.appendSection();
          O[0] = `[${w2}]${o2.preferCommentForThis ? xt(p, De) || We(s, g2) : We(s, g2) || xt(p, De)}`, i ? (O[1] = "", yield O.assignBlock(w2 + ".", "", p, H(p)), c && O.length !== 2 && O.appendNewline()) : (yield O.assignBlock(w2 + ".", "", p, H(p)), c && O.appendNewline());
          continue;
        }
        const D3 = n + x;
        this.appendLine = xn(D3) + " = ";
        const W2 = this.value("", p, true);
        W2 ? (--this.length, yield this.assignBlock(w2 + ".", D3 + ".", p, W2), u && this.appendNewline()) : (this.appendInlineIf = We(s, g2), d2 && this.appendNewline());
      }
    }
    value(t, n, s) {
      switch (typeof n) {
        case "object":
          if (n === null) {
            if (this.document.nullDisabled) throw h('toml can not stringify "null" type value without truthy options.xNull');
            this.appendInline = "null";
            break;
          }
          const r = Pr(n);
          if (ce(n)) {
            if (r === S) this.staticArray(t, n);
            else {
              const { $singlelineArray: o2 = r } = this.document;
              this.singlelineArray(t, n, o2);
            }
            break;
          }
          if (r !== S) {
            r || this.document.multilineTableDisabled ? this.inlineTable(t, n) : this.multilineTable(t, n, this.document.multilineTableComma);
            break;
          }
          if (No(n)) {
            this.appendInline = n.toISOString().replace("T", this.document.T).replace("Z", this.document.Z);
            break;
          }
          if (an in n) {
            const o2 = n[an];
            if (typeof o2 == "string") this.appendInline = o2;
            else if (ce(o2)) {
              const { length: i } = o2;
              if (i) {
                this.appendInline = o2[0];
                let c = 1;
                for (; c !== i; ) this.appendLine = o2[c++];
              } else throw h("literal value is broken");
            } else throw h("literal value is broken");
            break;
          }
          if (bo(n)) throw h("TOML.stringify refuse to handle [object String]");
          if (yo(n)) throw h("TOML.stringify refuse to handle [object Number]");
          if (mo(n)) throw h("TOML.stringify refuse to handle [object BigInt]");
          if (xo(n)) throw h("TOML.stringify refuse to handle [object Boolean]");
          if (s) {
            const o2 = H(n);
            if (o2.length) return o2;
            this.appendInline = "{ }";
          } else this.inlineTable(t, n);
          break;
        case "bigint":
          this.appendInline = "" + n;
          break;
        case "number":
          this.appendInline = this.document.asInteger(n) ? Ct(n, -0) ? "-0" : "" + n : Co(n);
          break;
        case "string":
          this.appendInline = rr(n);
          break;
        case "boolean":
          this.appendInline = n ? "true" : "false";
          break;
        default:
          throw h(`toml can not stringify "${typeof n}" type value`);
      }
      return null;
    }
    singlelineArray(t, n, s) {
      const { length: r } = n;
      if (r) {
        this.appendInline = s & 2 ? "[ " : "[", this.value(t, n[0], false);
        let o2 = 1;
        for (; o2 !== r; ) this.appendInline = ", ", this.value(t, n[o2++], false);
        this.appendInline = s & 2 ? " ]" : "]";
      } else this.appendInline = s & 1 ? "[ ]" : "[]";
    }
    staticArray(t, n) {
      this.appendInline = "[";
      const s = t + this.document.indent, { length: r } = n;
      let o2 = 0;
      for (; o2 !== r; ) this.appendLine = s, this.value(s, n[o2++], false), this.appendInline = ",";
      this.appendLine = t + "]";
    }
    inlineTable(t, n) {
      const s = H(n);
      s.length ? (this.appendInline = "{ ", this.assignInline(t, n, "", s), this[this.length - 1] = this[this.length - 1].slice(0, -2) + " }") : this.appendInline = "{ }";
    }
    multilineTable(t, n, s) {
      this.appendInline = "{", this.assignMultiline(t, n, "", H(n), s), this.appendLine = t + "}";
    }
    assignInline(t, n, s, r) {
      for (const o2 of r) {
        const i = n[o2], c = s + mn(o2), u = this.appendInline = xn(c) + " = ", d2 = this.value(t, i, true);
        d2 ? (this[this.length - 1] = this[this.length - 1].slice(0, -u.length), this.assignInline(t, i, c + ".", d2)) : this.appendInline = ", ";
      }
    }
    assignMultiline(t, n, s, r, o2) {
      const i = t + this.document.indent;
      for (const c of r) {
        const u = n[c], d2 = s + mn(c);
        this.appendLine = i + xn(d2) + " = ";
        const g2 = this.value(i, u, true);
        g2 ? (--this.length, this.assignMultiline(t, u, d2 + ".", g2, o2)) : o2 ? this.appendInline = "," + We(n, c) : this.appendInlineIf = We(n, c);
      }
    }
  };
  var pr = C({ document: 0, section: 1, header: 2, pairs: 3, pair: 4 });
  var { test: Uo } = _(/^[\t ]*$/);
  var Po = () => false;
  var jo = class extends Ye {
    constructor(t) {
      super();
      __publicField(this, 0, new dr(this));
      __publicField(this, "asInteger", Po);
      __publicField(this, "newline", "");
      __publicField(this, "newlineUnderSection", true);
      __publicField(this, "newlineUnderSectionButPair", true);
      __publicField(this, "newlineUnderHeader", true);
      __publicField(this, "newlineUnderPair", false);
      __publicField(this, "newlineUnderPairButDotted", false);
      __publicField(this, "newlineUnderDotted", false);
      __publicField(this, "indent", "	");
      __publicField(this, "T", "T");
      __publicField(this, "Z", "Z");
      __publicField(this, "nullDisabled", true);
      __publicField(this, "multilineTableDisabled", true);
      __publicField(this, "multilineTableComma");
      __publicField(this, "preferCommentForThis", false);
      __publicField(this, "$singlelineArray");
      if (t == null) return this;
      const { integer: n } = t;
      if (n !== void 0) if (n === To) this.asInteger = _e;
      else if (typeof n == "number") {
        if (!_e(n)) throw b("TOML.stringify(,{integer}) can only be a safe integer");
        const p = n >= 0 ? n : -n - 1, x = n >= 0 ? -n : n;
        this.asInteger = (w2) => _e(w2) && x <= w2 && w2 <= p;
      } else throw h("TOML.stringify(,{integer}) can only be number");
      const { newline: s } = t;
      if (s !== void 0) if (s === `
` || s === `\r
`) this.newline = s;
      else throw typeof s == "string" ? f("TOML.stringify(,{newline}) can only be valid TOML newline") : h("TOML.stringify(,{newline}) can only be string");
      const { preferCommentFor: r } = t;
      if (r !== void 0) if (r === "this" || r === "key") this.preferCommentForThis = r === "this";
      else throw h("TOML.stringify(,{preferCommentFor) can only be 'key' or 'this'");
      const { [t.newlineAround || "header"]: o2 = pr.header } = pr;
      this.newlineUnderSection = o2 > 0, this.newlineUnderSectionButPair = o2 === 1 || o2 === 2, this.newlineUnderHeader = o2 > 1, this.newlineUnderPair = o2 > 2, this.newlineUnderPairButDotted = o2 === 3, this.newlineUnderDotted = o2 > 3;
      const { indent: i } = t;
      if (i !== void 0) if (typeof i == "string") {
        if (!Uo(i)) throw f("TOML.stringify(,{indent}) can only include Tab or Space");
        this.indent = i;
      } else if (typeof i == "number") {
        if (!_e(i)) throw b(`TOML.stringify(,{indent:${i}}) is out of range`);
        this.indent = " ".repeat(i);
      } else throw h(`TOML.stringify(,{indent}) can not be "${typeof i}" type`);
      const { T: c } = t;
      if (c !== void 0) if (c === " " || c === "t" || c === "T") this.T = c;
      else throw h('TOML.stringify(,{T}) can only be "T" or " " or "t"');
      const { Z: u } = t;
      if (u !== void 0) if (u === "z" || u === "Z") this.Z = u;
      else throw h('TOML.stringify(,{Z}) can only be "Z" or "z"');
      t.xNull && (this.nullDisabled = false);
      const { xBeforeNewlineInMultilineTable: d2 } = t;
      if (d2 !== void 0) if (d2 === "" || d2 === ",") this.multilineTableDisabled = false, this.multilineTableComma = !!d2;
      else throw h('TOML.stringify(,{xBeforeNewlineInMultilineTable}) can only be "" or ","');
      const g2 = t.forceInlineArraySpacing;
      switch (g2) {
        case void 0:
          break;
        case 0:
        case 1:
        case 2:
        case 3:
          this.$singlelineArray = g2;
          break;
        default:
          throw typeof g2 == "number" ? b(`array inline mode must be 0 | 1 | 2 | 3, not including ${g2}`) : h(`array inline mode must be "number" type, not including ${g2 === null ? '"null"' : typeof g2}`);
      }
      return this;
    }
    get ["constructor"]() {
      return Ye;
    }
    appendSection() {
      return this[this.length] = new dr(this);
    }
  };
  var gr = new ae();
  var Wo = le.bind(gr);
  var Go = ye.bind(gr);
  var _r = (e, t) => {
    const n = new jo(t), s = n[0];
    if (s[0] = "", Ls(s.assignBlock("", "", e, H(e))), n.newlineUnderSectionButPair && s.length !== 1 && s.appendNewline(), n.newlineUnderSection || n[n.length - 1].appendNewline(), n.newline) return n.join(n.newline);
    const r = n.flat();
    return Wo(r), r;
  };
  var Tr = (() => {
    const e = (t, n) => typeof t == "string" ? m((So(t) ? yn : Do)((`
` + t).split(`
`)), t) : ce(t) ? m(Fo(ir(t)), typeof n == "string" ? n : C(null)) : jr(t);
    return e.basic = (t, n) => typeof t == "string" ? m(yn((`
` + t).split(`
`)), t) : m(yn(ir(t)), typeof n == "string" ? n : C(null)), e.array = Wr, $(e), e;
  })();
  var wr = (e) => m(Eo(e), e);
  var br = (e, ...t) => {
    if (typeof e == "string") {
      if (t.length === 1) return m(e.includes(`
`) ? e.split(`
`) : e, t[0]);
    } else {
      let n = t.length;
      if (n) {
        const { raw: s } = e;
        for (e = s[n]; n; ) t[--n] += s[n];
        e = t.join("") + e;
      } else e = e.raw[0];
    }
    return m(e.includes(`
`) ? e.split(`
`) : e, C(null));
  };
  var Yo = new Si("utf-8", C({ fatal: true, ignoreBOM: false }));
  var Et = (e) => {
    if (Ei(e) ? e.length !== e.byteLength : !Oi(e)) throw h("only Uint8Array or ArrayBuffer is acceptable");
    try {
      return Yo.decode(e);
    } catch {
      throw I("A TOML doc must be a (ful-scalar) valid UTF-8 file, without any unknown code point.");
    }
  };
  var Ot = (e) => "byteLength" in e;
  var { test: Ho } = _(/[\uD800-\uDFFF]/u);
  var In = (e) => {
    if (Yn(Ho(e))) throw I("A TOML doc must be a (ful-scalar) valid UTF-8 file, without any uncoupled UCS-4 character code.");
  };
  var En = false;
  var V = (e, t, n, s, r, o2) => {
    let i = "";
    if (typeof e == "object" && e) {
      if (ce(e)) throw h(Go(e) ? "TOML.parse(array from TOML.stringify(,{newline?}))" : "TOML.parse(array)");
      if (Ot(e)) e = Et(e);
      else {
        if (i = e.path, typeof i != "string") throw h("TOML.parse(source.path)");
        const { data: p, require: x = typeof __require == "function" ? __require : S } = e;
        if (x) {
          const { resolve: w2 } = x;
          if (w2 != null) {
            const { paths: D3 } = w2;
            if (D3 != null) {
              const W2 = $t(D3, w2, [""]);
              if (W2 != null) {
                const O = W2[0];
                if (O != null) {
                  const G3 = O.replace(/node_modules$/, "");
                  if (G3 && (i = x("path").resolve(G3, i), typeof i != "string")) throw h("TOML.parse(source.require('path').resolve)");
                }
              }
            }
          }
          if (p === S) {
            const D3 = x("fs").readFileSync(i);
            if (typeof D3 == "object" && D3 && Ot(D3)) e = Et(D3);
            else throw h("TOML.parse(source.require('fs').readFileSync)");
          } else if (typeof p == "string") In(e = p);
          else if (typeof p == "object" && p && Ot(p)) e = Et(p);
          else throw h("TOML.parse(source.data)");
        } else {
          if (p === S) throw h("TOML.parse(source.data|source.require)");
          if (typeof p == "string") In(e = p);
          else if (typeof p == "object" && p && Ot(p)) e = Et(p);
          else throw h("TOML.parse(source.data)");
        }
      }
    } else if (typeof e == "string") In(e);
    else throw h("TOML.parse(source)");
    let c, u;
    if (typeof n == "object" && n) {
      if (s !== S || r !== S) throw h("options mode ? args mode");
      c = n.joiner, s = n.bigint, u = n.keys, r = n.x, o2 = "";
    } else c = n;
    let d2, g2;
    if (En) throw I("parsing during parsing.");
    En = true;
    try {
      Ii(t, c, s, u, r, o2), Xr(e, i), e && e[0] === "\uFEFF" && a(h("TOML content (string) should not start with BOM (U+FEFF)" + l(" at "))), d2 = _o(), g2 = mi();
    } finally {
      Vr(), xi(), En = false, Yn();
    }
    return g2 && g2(), d2;
  };
  var yr = R((e, t, n, s, r) => typeof t == "number" ? V(e, t, n, s, r, ",,") : V(e, 1, t, n, s, ","), { "1.0": (e, t, n, s) => V(e, 0.1, t, n, s, ","), 1: (e, t, n, s) => V(e, 1, t, n, s, ","), 0.5: (e, t, n, s) => V(e, 0.5, t, n, s, ","), 0.4: (e, t, n, s) => V(e, 0.4, t, n, s, ","), 0.3: (e, t, n, s) => V(e, 0.3, t, n, s, ","), 0.2: (e, t, n, s) => V(e, 0.2, t, n, s, ","), 0.1: (e, t, n, s) => V(e, 0.1, t, n, s, ",") });
  var Zo = xr({ version: Ln, parse: yr, stringify: _r, Section: rs, inline: ss, multiline: Tr, basic: wr, literal: br, commentFor: je, commentForThis: De, OffsetDateTime: ht, LocalDateTime: dt, LocalDate: gt, LocalTime: _t, isInline: Ke, isSection: me, Keys: Xt });

  // js/vendor/strnum.mjs
  var strnum_exports = {};
  __export(strnum_exports, {
    default: () => m2
  });
  var a2;
  var o;
  function b2() {
    if (o) return a2;
    o = 1;
    const c = /^[-+]?0x[a-fA-F0-9]+$/, d2 = /^([\-\+])?(0*)(\.[0-9]+([eE]\-?[0-9]+)?|[0-9]+(\.[0-9]+([eE]\-?[0-9]+)?)?)$/;
    !Number.parseInt && window.parseInt && (Number.parseInt = window.parseInt), !Number.parseFloat && window.parseFloat && (Number.parseFloat = window.parseFloat);
    const g2 = { hex: true, leadingZeros: true, decimalPoint: ".", eNotation: true };
    function x(e, i = {}) {
      if (i = Object.assign({}, g2, i), !e || typeof e != "string") return e;
      let r = e.trim();
      if (i.skipLike !== void 0 && i.skipLike.test(r)) return e;
      if (i.hex && c.test(r)) return Number.parseInt(r, 16);
      {
        const s = d2.exec(r);
        if (s) {
          const f3 = s[1], l2 = s[2];
          let u = N2(s[3]);
          const h2 = s[4] || s[6];
          if (!i.leadingZeros && l2.length > 0 && f3 && r[2] !== ".") return e;
          if (!i.leadingZeros && l2.length > 0 && !f3 && r[1] !== ".") return e;
          {
            const n = Number(r), t = "" + n;
            return t.search(/[eE]/) !== -1 || h2 ? i.eNotation ? n : e : r.indexOf(".") !== -1 ? t === "0" && u === "" || t === u || f3 && t === "-" + u ? n : e : l2 ? u === t || f3 + u === t ? n : e : r === t || r === f3 + t ? n : e;
          }
        } else return e;
      }
    }
    function N2(e) {
      return e && e.indexOf(".") !== -1 && (e = e.replace(/0+$/, ""), e === "." ? e = "0" : e[0] === "." ? e = "0" + e : e[e.length - 1] === "." && (e = e.substr(0, e.length - 1))), e;
    }
    return a2 = x, a2;
  }
  var m2 = b2();

  // js/vendor/fast-xml-parser.mjs
  function ae2(y2) {
    return y2 && Object.prototype.hasOwnProperty.call(y2, "default") ? y2.default : y2;
  }
  var R2 = {};
  var q2 = {};
  var z2;
  function B2() {
    return z2 || (z2 = 1, (function(y2) {
      const v3 = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD", T2 = v3 + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040", S3 = "[" + v3 + "][" + T2 + "]*", V3 = new RegExp("^" + S3 + "$"), I2 = function(i, u) {
        const t = [];
        let e = u.exec(i);
        for (; e; ) {
          const h2 = [];
          h2.startIndex = u.lastIndex - e[0].length;
          const d2 = e.length;
          for (let m4 = 0; m4 < d2; m4++) h2.push(e[m4]);
          t.push(h2), e = u.exec(i);
        }
        return t;
      }, o2 = function(i) {
        const u = V3.exec(i);
        return !(u === null || typeof u > "u");
      };
      y2.isExist = function(i) {
        return typeof i < "u";
      }, y2.isEmptyObject = function(i) {
        return Object.keys(i).length === 0;
      }, y2.merge = function(i, u, t) {
        if (u) {
          const e = Object.keys(u), h2 = e.length;
          for (let d2 = 0; d2 < h2; d2++) t === "strict" ? i[e[d2]] = [u[e[d2]]] : i[e[d2]] = u[e[d2]];
        }
      }, y2.getValue = function(i) {
        return y2.isExist(i) ? i : "";
      }, y2.isName = o2, y2.getAllMatches = I2, y2.nameRegexp = S3;
    })(q2)), q2;
  }
  var j2;
  function H2() {
    if (j2) return R2;
    j2 = 1;
    const y2 = B2(), v3 = { allowBooleanAttributes: false, unpairedTags: [] };
    R2.validate = function(r, f3) {
      f3 = Object.assign({}, v3, f3);
      const N2 = [];
      let n = false, c = false;
      r[0] === "\uFEFF" && (r = r.substr(1));
      for (let s = 0; s < r.length; s++) if (r[s] === "<" && r[s + 1] === "?") {
        if (s += 2, s = S3(r, s), s.err) return s;
      } else if (r[s] === "<") {
        let p = s;
        if (s++, r[s] === "!") {
          s = V3(r, s);
          continue;
        } else {
          let g2 = false;
          r[s] === "/" && (g2 = true, s++);
          let a3 = "";
          for (; s < r.length && r[s] !== ">" && r[s] !== " " && r[s] !== "	" && r[s] !== `
` && r[s] !== "\r"; s++) a3 += r[s];
          if (a3 = a3.trim(), a3[a3.length - 1] === "/" && (a3 = a3.substring(0, a3.length - 1), s--), !P2(a3)) {
            let l2;
            return a3.trim().length === 0 ? l2 = "Invalid space after '<'." : l2 = "Tag '" + a3 + "' is an invalid name.", d2("InvalidTag", l2, E3(r, s));
          }
          const w2 = i(r, s);
          if (w2 === false) return d2("InvalidAttr", "Attributes for '" + a3 + "' have open quote.", E3(r, s));
          let b3 = w2.value;
          if (s = w2.index, b3[b3.length - 1] === "/") {
            const l2 = s - b3.length;
            b3 = b3.substring(0, b3.length - 1);
            const A3 = t(b3, f3);
            if (A3 === true) n = true;
            else return d2(A3.err.code, A3.err.msg, E3(r, l2 + A3.err.line));
          } else if (g2) if (w2.tagClosed) {
            if (b3.trim().length > 0) return d2("InvalidTag", "Closing tag '" + a3 + "' can't have attributes or invalid starting.", E3(r, p));
            if (N2.length === 0) return d2("InvalidTag", "Closing tag '" + a3 + "' has not been opened.", E3(r, p));
            {
              const l2 = N2.pop();
              if (a3 !== l2.tagName) {
                let A3 = E3(r, l2.tagStartPos);
                return d2("InvalidTag", "Expected closing tag '" + l2.tagName + "' (opened in line " + A3.line + ", col " + A3.col + ") instead of closing tag '" + a3 + "'.", E3(r, p));
              }
              N2.length == 0 && (c = true);
            }
          } else return d2("InvalidTag", "Closing tag '" + a3 + "' doesn't have proper closing.", E3(r, s));
          else {
            const l2 = t(b3, f3);
            if (l2 !== true) return d2(l2.err.code, l2.err.msg, E3(r, s - b3.length + l2.err.line));
            if (c === true) return d2("InvalidXml", "Multiple possible root nodes found.", E3(r, s));
            f3.unpairedTags.indexOf(a3) !== -1 || N2.push({ tagName: a3, tagStartPos: p }), n = true;
          }
          for (s++; s < r.length; s++) if (r[s] === "<") if (r[s + 1] === "!") {
            s++, s = V3(r, s);
            continue;
          } else if (r[s + 1] === "?") {
            if (s = S3(r, ++s), s.err) return s;
          } else break;
          else if (r[s] === "&") {
            const l2 = h2(r, s);
            if (l2 == -1) return d2("InvalidChar", "char '&' is not expected.", E3(r, s));
            s = l2;
          } else if (c === true && !T2(r[s])) return d2("InvalidXml", "Extra text at the end", E3(r, s));
          r[s] === "<" && s--;
        }
      } else {
        if (T2(r[s])) continue;
        return d2("InvalidChar", "char '" + r[s] + "' is not expected.", E3(r, s));
      }
      if (n) {
        if (N2.length == 1) return d2("InvalidTag", "Unclosed tag '" + N2[0].tagName + "'.", E3(r, N2[0].tagStartPos));
        if (N2.length > 0) return d2("InvalidXml", "Invalid '" + JSON.stringify(N2.map((s) => s.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 });
      } else return d2("InvalidXml", "Start tag expected.", 1);
      return true;
    };
    function T2(r) {
      return r === " " || r === "	" || r === `
` || r === "\r";
    }
    function S3(r, f3) {
      const N2 = f3;
      for (; f3 < r.length; f3++) if (r[f3] == "?" || r[f3] == " ") {
        const n = r.substr(N2, f3 - N2);
        if (f3 > 5 && n === "xml") return d2("InvalidXml", "XML declaration allowed only at the start of the document.", E3(r, f3));
        if (r[f3] == "?" && r[f3 + 1] == ">") {
          f3++;
          break;
        } else continue;
      }
      return f3;
    }
    function V3(r, f3) {
      if (r.length > f3 + 5 && r[f3 + 1] === "-" && r[f3 + 2] === "-") {
        for (f3 += 3; f3 < r.length; f3++) if (r[f3] === "-" && r[f3 + 1] === "-" && r[f3 + 2] === ">") {
          f3 += 2;
          break;
        }
      } else if (r.length > f3 + 8 && r[f3 + 1] === "D" && r[f3 + 2] === "O" && r[f3 + 3] === "C" && r[f3 + 4] === "T" && r[f3 + 5] === "Y" && r[f3 + 6] === "P" && r[f3 + 7] === "E") {
        let N2 = 1;
        for (f3 += 8; f3 < r.length; f3++) if (r[f3] === "<") N2++;
        else if (r[f3] === ">" && (N2--, N2 === 0)) break;
      } else if (r.length > f3 + 9 && r[f3 + 1] === "[" && r[f3 + 2] === "C" && r[f3 + 3] === "D" && r[f3 + 4] === "A" && r[f3 + 5] === "T" && r[f3 + 6] === "A" && r[f3 + 7] === "[") {
        for (f3 += 8; f3 < r.length; f3++) if (r[f3] === "]" && r[f3 + 1] === "]" && r[f3 + 2] === ">") {
          f3 += 2;
          break;
        }
      }
      return f3;
    }
    const I2 = '"', o2 = "'";
    function i(r, f3) {
      let N2 = "", n = "", c = false;
      for (; f3 < r.length; f3++) {
        if (r[f3] === I2 || r[f3] === o2) n === "" ? n = r[f3] : n !== r[f3] || (n = "");
        else if (r[f3] === ">" && n === "") {
          c = true;
          break;
        }
        N2 += r[f3];
      }
      return n !== "" ? false : { value: N2, index: f3, tagClosed: c };
    }
    const u = new RegExp(`(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['"])(([\\s\\S])*?)\\5)?`, "g");
    function t(r, f3) {
      const N2 = y2.getAllMatches(r, u), n = {};
      for (let c = 0; c < N2.length; c++) {
        if (N2[c][1].length === 0) return d2("InvalidAttr", "Attribute '" + N2[c][2] + "' has no space in starting.", C3(N2[c]));
        if (N2[c][3] !== void 0 && N2[c][4] === void 0) return d2("InvalidAttr", "Attribute '" + N2[c][2] + "' is without value.", C3(N2[c]));
        if (N2[c][3] === void 0 && !f3.allowBooleanAttributes) return d2("InvalidAttr", "boolean attribute '" + N2[c][2] + "' is not allowed.", C3(N2[c]));
        const s = N2[c][2];
        if (!m4(s)) return d2("InvalidAttr", "Attribute '" + s + "' is an invalid name.", C3(N2[c]));
        if (!n.hasOwnProperty(s)) n[s] = 1;
        else return d2("InvalidAttr", "Attribute '" + s + "' is repeated.", C3(N2[c]));
      }
      return true;
    }
    function e(r, f3) {
      let N2 = /\d/;
      for (r[f3] === "x" && (f3++, N2 = /[\da-fA-F]/); f3 < r.length; f3++) {
        if (r[f3] === ";") return f3;
        if (!r[f3].match(N2)) break;
      }
      return -1;
    }
    function h2(r, f3) {
      if (f3++, r[f3] === ";") return -1;
      if (r[f3] === "#") return f3++, e(r, f3);
      let N2 = 0;
      for (; f3 < r.length; f3++, N2++) if (!(r[f3].match(/\w/) && N2 < 20)) {
        if (r[f3] === ";") break;
        return -1;
      }
      return f3;
    }
    function d2(r, f3, N2) {
      return { err: { code: r, msg: f3, line: N2.line || N2, col: N2.col } };
    }
    function m4(r) {
      return y2.isName(r);
    }
    function P2(r) {
      return y2.isName(r);
    }
    function E3(r, f3) {
      const N2 = r.substring(0, f3).split(/\r?\n/);
      return { line: N2.length, col: N2[N2.length - 1].length + 1 };
    }
    function C3(r) {
      return r.startIndex + r[1].length;
    }
    return R2;
  }
  var L2 = {};
  var D;
  function le2() {
    if (D) return L2;
    D = 1;
    const y2 = { preserveOrder: false, attributeNamePrefix: "@_", attributesGroupName: false, textNodeName: "#text", ignoreAttributes: true, removeNSPrefix: false, allowBooleanAttributes: false, parseTagValue: true, parseAttributeValue: false, trimValues: true, cdataPropName: false, numberParseOptions: { hex: true, leadingZeros: true, eNotation: true }, tagValueProcessor: function(T2, S3) {
      return S3;
    }, attributeValueProcessor: function(T2, S3) {
      return S3;
    }, stopNodes: [], alwaysCreateTextNode: false, isArray: () => false, commentPropName: false, unpairedTags: [], processEntities: true, htmlEntities: false, ignoreDeclaration: false, ignorePiTags: false, transformTagName: false, transformAttributeName: false, updateTag: function(T2, S3, V3) {
      return T2;
    } }, v3 = function(T2) {
      return Object.assign({}, y2, T2);
    };
    return L2.buildOptions = v3, L2.defaultOptions = y2, L2;
  }
  var M2;
  var ee2;
  function de2() {
    if (ee2) return M2;
    ee2 = 1;
    class y2 {
      constructor(T2) {
        this.tagname = T2, this.child = [], this[":@"] = {};
      }
      add(T2, S3) {
        T2 === "__proto__" && (T2 = "#__proto__"), this.child.push({ [T2]: S3 });
      }
      addChild(T2) {
        T2.tagname === "__proto__" && (T2.tagname = "#__proto__"), T2[":@"] && Object.keys(T2[":@"]).length > 0 ? this.child.push({ [T2.tagname]: T2.child, ":@": T2[":@"] }) : this.child.push({ [T2.tagname]: T2.child });
      }
    }
    return M2 = y2, M2;
  }
  var k2;
  var te2;
  function ce2() {
    if (te2) return k2;
    te2 = 1;
    const y2 = B2();
    function v3(t, e) {
      const h2 = {};
      if (t[e + 3] === "O" && t[e + 4] === "C" && t[e + 5] === "T" && t[e + 6] === "Y" && t[e + 7] === "P" && t[e + 8] === "E") {
        e = e + 9;
        let d2 = 1, m4 = false, P2 = false, E3 = "";
        for (; e < t.length; e++) if (t[e] === "<" && !P2) {
          if (m4 && V3(t, e)) e += 7, [entityName, val, e] = T2(t, e + 1), val.indexOf("&") === -1 && (h2[u(entityName)] = { regx: RegExp(`&${entityName};`, "g"), val });
          else if (m4 && I2(t, e)) e += 8;
          else if (m4 && o2(t, e)) e += 8;
          else if (m4 && i(t, e)) e += 9;
          else if (S3) P2 = true;
          else throw new Error("Invalid DOCTYPE");
          d2++, E3 = "";
        } else if (t[e] === ">") {
          if (P2 ? t[e - 1] === "-" && t[e - 2] === "-" && (P2 = false, d2--) : d2--, d2 === 0) break;
        } else t[e] === "[" ? m4 = true : E3 += t[e];
        if (d2 !== 0) throw new Error("Unclosed DOCTYPE");
      } else throw new Error("Invalid Tag instead of DOCTYPE");
      return { entities: h2, i: e };
    }
    function T2(t, e) {
      let h2 = "";
      for (; e < t.length && t[e] !== "'" && t[e] !== '"'; e++) h2 += t[e];
      if (h2 = h2.trim(), h2.indexOf(" ") !== -1) throw new Error("External entites are not supported");
      const d2 = t[e++];
      let m4 = "";
      for (; e < t.length && t[e] !== d2; e++) m4 += t[e];
      return [h2, m4, e];
    }
    function S3(t, e) {
      return t[e + 1] === "!" && t[e + 2] === "-" && t[e + 3] === "-";
    }
    function V3(t, e) {
      return t[e + 1] === "!" && t[e + 2] === "E" && t[e + 3] === "N" && t[e + 4] === "T" && t[e + 5] === "I" && t[e + 6] === "T" && t[e + 7] === "Y";
    }
    function I2(t, e) {
      return t[e + 1] === "!" && t[e + 2] === "E" && t[e + 3] === "L" && t[e + 4] === "E" && t[e + 5] === "M" && t[e + 6] === "E" && t[e + 7] === "N" && t[e + 8] === "T";
    }
    function o2(t, e) {
      return t[e + 1] === "!" && t[e + 2] === "A" && t[e + 3] === "T" && t[e + 4] === "T" && t[e + 5] === "L" && t[e + 6] === "I" && t[e + 7] === "S" && t[e + 8] === "T";
    }
    function i(t, e) {
      return t[e + 1] === "!" && t[e + 2] === "N" && t[e + 3] === "O" && t[e + 4] === "T" && t[e + 5] === "A" && t[e + 6] === "T" && t[e + 7] === "I" && t[e + 8] === "O" && t[e + 9] === "N";
    }
    function u(t) {
      if (y2.isName(t)) return t;
      throw new Error(`Invalid entity name ${t}`);
    }
    return k2 = v3, k2;
  }
  var he2 = ae2(strnum_exports);
  var G;
  var se2;
  function ge2() {
    if (se2) return G;
    se2 = 1;
    const y2 = B2(), v3 = de2(), T2 = ce2(), S3 = he2;
    class V3 {
      constructor(c) {
        this.options = c, this.currentNode = null, this.tagsNodeStack = [], this.docTypeEntities = {}, this.lastEntities = { apos: { regex: /&(apos|#39|#x27);/g, val: "'" }, gt: { regex: /&(gt|#62|#x3E);/g, val: ">" }, lt: { regex: /&(lt|#60|#x3C);/g, val: "<" }, quot: { regex: /&(quot|#34|#x22);/g, val: '"' } }, this.ampEntity = { regex: /&(amp|#38|#x26);/g, val: "&" }, this.htmlEntities = { space: { regex: /&(nbsp|#160);/g, val: " " }, cent: { regex: /&(cent|#162);/g, val: "\xA2" }, pound: { regex: /&(pound|#163);/g, val: "\xA3" }, yen: { regex: /&(yen|#165);/g, val: "\xA5" }, euro: { regex: /&(euro|#8364);/g, val: "\u20AC" }, copyright: { regex: /&(copy|#169);/g, val: "\xA9" }, reg: { regex: /&(reg|#174);/g, val: "\xAE" }, inr: { regex: /&(inr|#8377);/g, val: "\u20B9" }, num_dec: { regex: /&#([0-9]{1,7});/g, val: (s, p) => String.fromCharCode(Number.parseInt(p, 10)) }, num_hex: { regex: /&#x([0-9a-fA-F]{1,6});/g, val: (s, p) => String.fromCharCode(Number.parseInt(p, 16)) } }, this.addExternalEntities = I2, this.parseXml = e, this.parseTextData = o2, this.resolveNameSpace = i, this.buildAttributesMap = t, this.isItStopNode = P2, this.replaceEntitiesValue = d2, this.readStopNodeData = f3, this.saveTextToParentTag = m4, this.addChild = h2;
      }
    }
    function I2(n) {
      const c = Object.keys(n);
      for (let s = 0; s < c.length; s++) {
        const p = c[s];
        this.lastEntities[p] = { regex: new RegExp("&" + p + ";", "g"), val: n[p] };
      }
    }
    function o2(n, c, s, p, g2, a3, w2) {
      if (n !== void 0 && (this.options.trimValues && !p && (n = n.trim()), n.length > 0)) {
        w2 || (n = this.replaceEntitiesValue(n));
        const b3 = this.options.tagValueProcessor(c, n, s, g2, a3);
        return b3 == null ? n : typeof b3 != typeof n || b3 !== n ? b3 : this.options.trimValues ? N2(n, this.options.parseTagValue, this.options.numberParseOptions) : n.trim() === n ? N2(n, this.options.parseTagValue, this.options.numberParseOptions) : n;
      }
    }
    function i(n) {
      if (this.options.removeNSPrefix) {
        const c = n.split(":"), s = n.charAt(0) === "/" ? "/" : "";
        if (c[0] === "xmlns") return "";
        c.length === 2 && (n = s + c[1]);
      }
      return n;
    }
    const u = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
    function t(n, c, s) {
      if (!this.options.ignoreAttributes && typeof n == "string") {
        const p = y2.getAllMatches(n, u), g2 = p.length, a3 = {};
        for (let w2 = 0; w2 < g2; w2++) {
          const b3 = this.resolveNameSpace(p[w2][1]);
          let l2 = p[w2][4], A3 = this.options.attributeNamePrefix + b3;
          if (b3.length) if (this.options.transformAttributeName && (A3 = this.options.transformAttributeName(A3)), A3 === "__proto__" && (A3 = "#__proto__"), l2 !== void 0) {
            this.options.trimValues && (l2 = l2.trim()), l2 = this.replaceEntitiesValue(l2);
            const O = this.options.attributeValueProcessor(b3, l2, c);
            O == null ? a3[A3] = l2 : typeof O != typeof l2 || O !== l2 ? a3[A3] = O : a3[A3] = N2(l2, this.options.parseAttributeValue, this.options.numberParseOptions);
          } else this.options.allowBooleanAttributes && (a3[A3] = true);
        }
        if (!Object.keys(a3).length) return;
        if (this.options.attributesGroupName) {
          const w2 = {};
          return w2[this.options.attributesGroupName] = a3, w2;
        }
        return a3;
      }
    }
    const e = function(n) {
      n = n.replace(/\r\n?/g, `
`);
      const c = new v3("!xml");
      let s = c, p = "", g2 = "";
      for (let a3 = 0; a3 < n.length; a3++) if (n[a3] === "<") if (n[a3 + 1] === "/") {
        const b3 = C3(n, ">", a3, "Closing Tag is not closed.");
        let l2 = n.substring(a3 + 2, b3).trim();
        if (this.options.removeNSPrefix) {
          const _2 = l2.indexOf(":");
          _2 !== -1 && (l2 = l2.substr(_2 + 1));
        }
        this.options.transformTagName && (l2 = this.options.transformTagName(l2)), s && (p = this.saveTextToParentTag(p, s, g2));
        const A3 = g2.substring(g2.lastIndexOf(".") + 1);
        if (l2 && this.options.unpairedTags.indexOf(l2) !== -1) throw new Error(`Unpaired tag can not be used as closing tag: </${l2}>`);
        let O = 0;
        A3 && this.options.unpairedTags.indexOf(A3) !== -1 ? (O = g2.lastIndexOf(".", g2.lastIndexOf(".") - 1), this.tagsNodeStack.pop()) : O = g2.lastIndexOf("."), g2 = g2.substring(0, O), s = this.tagsNodeStack.pop(), p = "", a3 = b3;
      } else if (n[a3 + 1] === "?") {
        let b3 = r(n, a3, false, "?>");
        if (!b3) throw new Error("Pi Tag is not closed.");
        if (p = this.saveTextToParentTag(p, s, g2), !(this.options.ignoreDeclaration && b3.tagName === "?xml" || this.options.ignorePiTags)) {
          const l2 = new v3(b3.tagName);
          l2.add(this.options.textNodeName, ""), b3.tagName !== b3.tagExp && b3.attrExpPresent && (l2[":@"] = this.buildAttributesMap(b3.tagExp, g2, b3.tagName)), this.addChild(s, l2, g2);
        }
        a3 = b3.closeIndex + 1;
      } else if (n.substr(a3 + 1, 3) === "!--") {
        const b3 = C3(n, "-->", a3 + 4, "Comment is not closed.");
        if (this.options.commentPropName) {
          const l2 = n.substring(a3 + 4, b3 - 2);
          p = this.saveTextToParentTag(p, s, g2), s.add(this.options.commentPropName, [{ [this.options.textNodeName]: l2 }]);
        }
        a3 = b3;
      } else if (n.substr(a3 + 1, 2) === "!D") {
        const b3 = T2(n, a3);
        this.docTypeEntities = b3.entities, a3 = b3.i;
      } else if (n.substr(a3 + 1, 2) === "![") {
        const b3 = C3(n, "]]>", a3, "CDATA is not closed.") - 2, l2 = n.substring(a3 + 9, b3);
        p = this.saveTextToParentTag(p, s, g2);
        let A3 = this.parseTextData(l2, s.tagname, g2, true, false, true, true);
        A3 == null && (A3 = ""), this.options.cdataPropName ? s.add(this.options.cdataPropName, [{ [this.options.textNodeName]: l2 }]) : s.add(this.options.textNodeName, A3), a3 = b3 + 2;
      } else {
        let b3 = r(n, a3, this.options.removeNSPrefix), l2 = b3.tagName;
        const A3 = b3.rawTagName;
        let O = b3.tagExp, _2 = b3.attrExpPresent, Q3 = b3.closeIndex;
        this.options.transformTagName && (l2 = this.options.transformTagName(l2)), s && p && s.tagname !== "!xml" && (p = this.saveTextToParentTag(p, s, g2, false));
        const Z2 = s;
        if (Z2 && this.options.unpairedTags.indexOf(Z2.tagname) !== -1 && (s = this.tagsNodeStack.pop(), g2 = g2.substring(0, g2.lastIndexOf("."))), l2 !== c.tagname && (g2 += g2 ? "." + l2 : l2), this.isItStopNode(this.options.stopNodes, g2, l2)) {
          let x = "";
          if (O.length > 0 && O.lastIndexOf("/") === O.length - 1) l2[l2.length - 1] === "/" ? (l2 = l2.substr(0, l2.length - 1), g2 = g2.substr(0, g2.length - 1), O = l2) : O = O.substr(0, O.length - 1), a3 = b3.closeIndex;
          else if (this.options.unpairedTags.indexOf(l2) !== -1) a3 = b3.closeIndex;
          else {
            const $3 = this.readStopNodeData(n, A3, Q3 + 1);
            if (!$3) throw new Error(`Unexpected end of ${A3}`);
            a3 = $3.i, x = $3.tagContent;
          }
          const X2 = new v3(l2);
          l2 !== O && _2 && (X2[":@"] = this.buildAttributesMap(O, g2, l2)), x && (x = this.parseTextData(x, l2, g2, true, _2, true, true)), g2 = g2.substr(0, g2.lastIndexOf(".")), X2.add(this.options.textNodeName, x), this.addChild(s, X2, g2);
        } else {
          if (O.length > 0 && O.lastIndexOf("/") === O.length - 1) {
            l2[l2.length - 1] === "/" ? (l2 = l2.substr(0, l2.length - 1), g2 = g2.substr(0, g2.length - 1), O = l2) : O = O.substr(0, O.length - 1), this.options.transformTagName && (l2 = this.options.transformTagName(l2));
            const x = new v3(l2);
            l2 !== O && _2 && (x[":@"] = this.buildAttributesMap(O, g2, l2)), this.addChild(s, x, g2), g2 = g2.substr(0, g2.lastIndexOf("."));
          } else {
            const x = new v3(l2);
            this.tagsNodeStack.push(s), l2 !== O && _2 && (x[":@"] = this.buildAttributesMap(O, g2, l2)), this.addChild(s, x, g2), s = x;
          }
          p = "", a3 = Q3;
        }
      }
      else p += n[a3];
      return c.child;
    };
    function h2(n, c, s) {
      const p = this.options.updateTag(c.tagname, s, c[":@"]);
      p === false || (typeof p == "string" && (c.tagname = p), n.addChild(c));
    }
    const d2 = function(n) {
      if (this.options.processEntities) {
        for (let c in this.docTypeEntities) {
          const s = this.docTypeEntities[c];
          n = n.replace(s.regx, s.val);
        }
        for (let c in this.lastEntities) {
          const s = this.lastEntities[c];
          n = n.replace(s.regex, s.val);
        }
        if (this.options.htmlEntities) for (let c in this.htmlEntities) {
          const s = this.htmlEntities[c];
          n = n.replace(s.regex, s.val);
        }
        n = n.replace(this.ampEntity.regex, this.ampEntity.val);
      }
      return n;
    };
    function m4(n, c, s, p) {
      return n && (p === void 0 && (p = Object.keys(c.child).length === 0), n = this.parseTextData(n, c.tagname, s, false, c[":@"] ? Object.keys(c[":@"]).length !== 0 : false, p), n !== void 0 && n !== "" && c.add(this.options.textNodeName, n), n = ""), n;
    }
    function P2(n, c, s) {
      const p = "*." + s;
      for (const g2 in n) {
        const a3 = n[g2];
        if (p === a3 || c === a3) return true;
      }
      return false;
    }
    function E3(n, c, s = ">") {
      let p, g2 = "";
      for (let a3 = c; a3 < n.length; a3++) {
        let w2 = n[a3];
        if (p) w2 === p && (p = "");
        else if (w2 === '"' || w2 === "'") p = w2;
        else if (w2 === s[0]) if (s[1]) {
          if (n[a3 + 1] === s[1]) return { data: g2, index: a3 };
        } else return { data: g2, index: a3 };
        else w2 === "	" && (w2 = " ");
        g2 += w2;
      }
    }
    function C3(n, c, s, p) {
      const g2 = n.indexOf(c, s);
      if (g2 === -1) throw new Error(p);
      return g2 + c.length - 1;
    }
    function r(n, c, s, p = ">") {
      const g2 = E3(n, c + 1, p);
      if (!g2) return;
      let a3 = g2.data;
      const w2 = g2.index, b3 = a3.search(/\s/);
      let l2 = a3, A3 = true;
      b3 !== -1 && (l2 = a3.substring(0, b3), a3 = a3.substring(b3 + 1).trimStart());
      const O = l2;
      if (s) {
        const _2 = l2.indexOf(":");
        _2 !== -1 && (l2 = l2.substr(_2 + 1), A3 = l2 !== g2.data.substr(_2 + 1));
      }
      return { tagName: l2, tagExp: a3, closeIndex: w2, attrExpPresent: A3, rawTagName: O };
    }
    function f3(n, c, s) {
      const p = s;
      let g2 = 1;
      for (; s < n.length; s++) if (n[s] === "<") if (n[s + 1] === "/") {
        const a3 = C3(n, ">", s, `${c} is not closed`);
        if (n.substring(s + 2, a3).trim() === c && (g2--, g2 === 0)) return { tagContent: n.substring(p, s), i: a3 };
        s = a3;
      } else if (n[s + 1] === "?") s = C3(n, "?>", s + 1, "StopNode is not closed.");
      else if (n.substr(s + 1, 3) === "!--") s = C3(n, "-->", s + 3, "StopNode is not closed.");
      else if (n.substr(s + 1, 2) === "![") s = C3(n, "]]>", s, "StopNode is not closed.") - 2;
      else {
        const a3 = r(n, s, ">");
        a3 && ((a3 && a3.tagName) === c && a3.tagExp[a3.tagExp.length - 1] !== "/" && g2++, s = a3.closeIndex);
      }
    }
    function N2(n, c, s) {
      if (c && typeof n == "string") {
        const p = n.trim();
        return p === "true" ? true : p === "false" ? false : S3(n, s);
      } else return y2.isExist(n) ? n : "";
    }
    return G = V3, G;
  }
  var J2 = {};
  var re2;
  function pe2() {
    if (re2) return J2;
    re2 = 1;
    function y2(I2, o2) {
      return v3(I2, o2);
    }
    function v3(I2, o2, i) {
      let u;
      const t = {};
      for (let e = 0; e < I2.length; e++) {
        const h2 = I2[e], d2 = T2(h2);
        let m4 = "";
        if (i === void 0 ? m4 = d2 : m4 = i + "." + d2, d2 === o2.textNodeName) u === void 0 ? u = h2[d2] : u += "" + h2[d2];
        else {
          if (d2 === void 0) continue;
          if (h2[d2]) {
            let P2 = v3(h2[d2], o2, m4);
            const E3 = V3(P2, o2);
            h2[":@"] ? S3(P2, h2[":@"], m4, o2) : Object.keys(P2).length === 1 && P2[o2.textNodeName] !== void 0 && !o2.alwaysCreateTextNode ? P2 = P2[o2.textNodeName] : Object.keys(P2).length === 0 && (o2.alwaysCreateTextNode ? P2[o2.textNodeName] = "" : P2 = ""), t[d2] !== void 0 && t.hasOwnProperty(d2) ? (Array.isArray(t[d2]) || (t[d2] = [t[d2]]), t[d2].push(P2)) : o2.isArray(d2, m4, E3) ? t[d2] = [P2] : t[d2] = P2;
          }
        }
      }
      return typeof u == "string" ? u.length > 0 && (t[o2.textNodeName] = u) : u !== void 0 && (t[o2.textNodeName] = u), t;
    }
    function T2(I2) {
      const o2 = Object.keys(I2);
      for (let i = 0; i < o2.length; i++) {
        const u = o2[i];
        if (u !== ":@") return u;
      }
    }
    function S3(I2, o2, i, u) {
      if (o2) {
        const t = Object.keys(o2), e = t.length;
        for (let h2 = 0; h2 < e; h2++) {
          const d2 = t[h2];
          u.isArray(d2, i + "." + d2, true, true) ? I2[d2] = [o2[d2]] : I2[d2] = o2[d2];
        }
      }
    }
    function V3(I2, o2) {
      const { textNodeName: i } = o2, u = Object.keys(I2).length;
      return !!(u === 0 || u === 1 && (I2[i] || typeof I2[i] == "boolean" || I2[i] === 0));
    }
    return J2.prettify = y2, J2;
  }
  var U2;
  var ne2;
  function Ne2() {
    if (ne2) return U2;
    ne2 = 1;
    const { buildOptions: y2 } = le2(), v3 = ge2(), { prettify: T2 } = pe2(), S3 = H2();
    class V3 {
      constructor(o2) {
        this.externalEntities = {}, this.options = y2(o2);
      }
      parse(o2, i) {
        if (typeof o2 != "string") if (o2.toString) o2 = o2.toString();
        else throw new Error("XML data is accepted in String or Bytes[] form.");
        if (i) {
          i === true && (i = {});
          const e = S3.validate(o2, i);
          if (e !== true) throw Error(`${e.err.msg}:${e.err.line}:${e.err.col}`);
        }
        const u = new v3(this.options);
        u.addExternalEntities(this.externalEntities);
        const t = u.parseXml(o2);
        return this.options.preserveOrder || t === void 0 ? t : T2(t, this.options);
      }
      addEntity(o2, i) {
        if (i.indexOf("&") !== -1) throw new Error("Entity value can't have '&'");
        if (o2.indexOf("&") !== -1 || o2.indexOf(";") !== -1) throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
        if (i === "&") throw new Error("An entity with value '&' is not permitted");
        this.externalEntities[o2] = i;
      }
    }
    return U2 = V3, U2;
  }
  var Y2;
  var ie;
  function be2() {
    if (ie) return Y2;
    ie = 1;
    const y2 = `
`;
    function v3(i, u) {
      let t = "";
      return u.format && u.indentBy.length > 0 && (t = y2), T2(i, u, "", t);
    }
    function T2(i, u, t, e) {
      let h2 = "", d2 = false;
      for (let m4 = 0; m4 < i.length; m4++) {
        const P2 = i[m4], E3 = S3(P2);
        if (E3 === void 0) continue;
        let C3 = "";
        if (t.length === 0 ? C3 = E3 : C3 = `${t}.${E3}`, E3 === u.textNodeName) {
          let c = P2[E3];
          I2(C3, u) || (c = u.tagValueProcessor(E3, c), c = o2(c, u)), d2 && (h2 += e), h2 += c, d2 = false;
          continue;
        } else if (E3 === u.cdataPropName) {
          d2 && (h2 += e), h2 += `<![CDATA[${P2[E3][0][u.textNodeName]}]]>`, d2 = false;
          continue;
        } else if (E3 === u.commentPropName) {
          h2 += e + `<!--${P2[E3][0][u.textNodeName]}-->`, d2 = true;
          continue;
        } else if (E3[0] === "?") {
          const c = V3(P2[":@"], u), s = E3 === "?xml" ? "" : e;
          let p = P2[E3][0][u.textNodeName];
          p = p.length !== 0 ? " " + p : "", h2 += s + `<${E3}${p}${c}?>`, d2 = true;
          continue;
        }
        let r = e;
        r !== "" && (r += u.indentBy);
        const f3 = V3(P2[":@"], u), N2 = e + `<${E3}${f3}`, n = T2(P2[E3], u, C3, r);
        u.unpairedTags.indexOf(E3) !== -1 ? u.suppressUnpairedNode ? h2 += N2 + ">" : h2 += N2 + "/>" : (!n || n.length === 0) && u.suppressEmptyNode ? h2 += N2 + "/>" : n && n.endsWith(">") ? h2 += N2 + `>${n}${e}</${E3}>` : (h2 += N2 + ">", n && e !== "" && (n.includes("/>") || n.includes("</")) ? h2 += e + u.indentBy + n + e : h2 += n, h2 += `</${E3}>`), d2 = true;
      }
      return h2;
    }
    function S3(i) {
      const u = Object.keys(i);
      for (let t = 0; t < u.length; t++) {
        const e = u[t];
        if (i.hasOwnProperty(e) && e !== ":@") return e;
      }
    }
    function V3(i, u) {
      let t = "";
      if (i && !u.ignoreAttributes) for (let e in i) {
        if (!i.hasOwnProperty(e)) continue;
        let h2 = u.attributeValueProcessor(e, i[e]);
        h2 = o2(h2, u), h2 === true && u.suppressBooleanAttributes ? t += ` ${e.substr(u.attributeNamePrefix.length)}` : t += ` ${e.substr(u.attributeNamePrefix.length)}="${h2}"`;
      }
      return t;
    }
    function I2(i, u) {
      i = i.substr(0, i.length - u.textNodeName.length - 1);
      let t = i.substr(i.lastIndexOf(".") + 1);
      for (let e in u.stopNodes) if (u.stopNodes[e] === i || u.stopNodes[e] === "*." + t) return true;
      return false;
    }
    function o2(i, u) {
      if (i && i.length > 0 && u.processEntities) for (let t = 0; t < u.entities.length; t++) {
        const e = u.entities[t];
        i = i.replace(e.regex, e.val);
      }
      return i;
    }
    return Y2 = v3, Y2;
  }
  var W;
  var oe;
  function Ee2() {
    if (oe) return W;
    oe = 1;
    const y2 = be2(), v3 = { attributeNamePrefix: "@_", attributesGroupName: false, textNodeName: "#text", ignoreAttributes: true, cdataPropName: false, format: false, indentBy: "  ", suppressEmptyNode: false, suppressUnpairedNode: true, suppressBooleanAttributes: true, tagValueProcessor: function(o2, i) {
      return i;
    }, attributeValueProcessor: function(o2, i) {
      return i;
    }, preserveOrder: false, commentPropName: false, unpairedTags: [], entities: [{ regex: new RegExp("&", "g"), val: "&amp;" }, { regex: new RegExp(">", "g"), val: "&gt;" }, { regex: new RegExp("<", "g"), val: "&lt;" }, { regex: new RegExp("'", "g"), val: "&apos;" }, { regex: new RegExp('"', "g"), val: "&quot;" }], processEntities: true, stopNodes: [], oneListGroup: false };
    function T2(o2) {
      this.options = Object.assign({}, v3, o2), this.options.ignoreAttributes || this.options.attributesGroupName ? this.isAttribute = function() {
        return false;
      } : (this.attrPrefixLen = this.options.attributeNamePrefix.length, this.isAttribute = I2), this.processTextOrObjNode = S3, this.options.format ? (this.indentate = V3, this.tagEndChar = `>
`, this.newLine = `
`) : (this.indentate = function() {
        return "";
      }, this.tagEndChar = ">", this.newLine = "");
    }
    T2.prototype.build = function(o2) {
      return this.options.preserveOrder ? y2(o2, this.options) : (Array.isArray(o2) && this.options.arrayNodeName && this.options.arrayNodeName.length > 1 && (o2 = { [this.options.arrayNodeName]: o2 }), this.j2x(o2, 0).val);
    }, T2.prototype.j2x = function(o2, i) {
      let u = "", t = "";
      for (let e in o2) if (Object.prototype.hasOwnProperty.call(o2, e)) if (typeof o2[e] > "u") this.isAttribute(e) && (t += "");
      else if (o2[e] === null) this.isAttribute(e) ? t += "" : e[0] === "?" ? t += this.indentate(i) + "<" + e + "?" + this.tagEndChar : t += this.indentate(i) + "<" + e + "/" + this.tagEndChar;
      else if (o2[e] instanceof Date) t += this.buildTextValNode(o2[e], e, "", i);
      else if (typeof o2[e] != "object") {
        const h2 = this.isAttribute(e);
        if (h2) u += this.buildAttrPairStr(h2, "" + o2[e]);
        else if (e === this.options.textNodeName) {
          let d2 = this.options.tagValueProcessor(e, "" + o2[e]);
          t += this.replaceEntitiesValue(d2);
        } else t += this.buildTextValNode(o2[e], e, "", i);
      } else if (Array.isArray(o2[e])) {
        const h2 = o2[e].length;
        let d2 = "", m4 = "";
        for (let P2 = 0; P2 < h2; P2++) {
          const E3 = o2[e][P2];
          if (!(typeof E3 > "u")) if (E3 === null) e[0] === "?" ? t += this.indentate(i) + "<" + e + "?" + this.tagEndChar : t += this.indentate(i) + "<" + e + "/" + this.tagEndChar;
          else if (typeof E3 == "object") if (this.options.oneListGroup) {
            const C3 = this.j2x(E3, i + 1);
            d2 += C3.val, this.options.attributesGroupName && E3.hasOwnProperty(this.options.attributesGroupName) && (m4 += C3.attrStr);
          } else d2 += this.processTextOrObjNode(E3, e, i);
          else if (this.options.oneListGroup) {
            let C3 = this.options.tagValueProcessor(e, E3);
            C3 = this.replaceEntitiesValue(C3), d2 += C3;
          } else d2 += this.buildTextValNode(E3, e, "", i);
        }
        this.options.oneListGroup && (d2 = this.buildObjectNode(d2, e, m4, i)), t += d2;
      } else if (this.options.attributesGroupName && e === this.options.attributesGroupName) {
        const h2 = Object.keys(o2[e]), d2 = h2.length;
        for (let m4 = 0; m4 < d2; m4++) u += this.buildAttrPairStr(h2[m4], "" + o2[e][h2[m4]]);
      } else t += this.processTextOrObjNode(o2[e], e, i);
      return { attrStr: u, val: t };
    }, T2.prototype.buildAttrPairStr = function(o2, i) {
      return i = this.options.attributeValueProcessor(o2, "" + i), i = this.replaceEntitiesValue(i), this.options.suppressBooleanAttributes && i === "true" ? " " + o2 : " " + o2 + '="' + i + '"';
    };
    function S3(o2, i, u) {
      const t = this.j2x(o2, u + 1);
      return o2[this.options.textNodeName] !== void 0 && Object.keys(o2).length === 1 ? this.buildTextValNode(o2[this.options.textNodeName], i, t.attrStr, u) : this.buildObjectNode(t.val, i, t.attrStr, u);
    }
    T2.prototype.buildObjectNode = function(o2, i, u, t) {
      if (o2 === "") return i[0] === "?" ? this.indentate(t) + "<" + i + u + "?" + this.tagEndChar : this.indentate(t) + "<" + i + u + this.closeTag(i) + this.tagEndChar;
      {
        let e = "</" + i + this.tagEndChar, h2 = "";
        return i[0] === "?" && (h2 = "?", e = ""), (u || u === "") && o2.indexOf("<") === -1 ? this.indentate(t) + "<" + i + u + h2 + ">" + o2 + e : this.options.commentPropName !== false && i === this.options.commentPropName && h2.length === 0 ? this.indentate(t) + `<!--${o2}-->` + this.newLine : this.indentate(t) + "<" + i + u + h2 + this.tagEndChar + o2 + this.indentate(t) + e;
      }
    }, T2.prototype.closeTag = function(o2) {
      let i = "";
      return this.options.unpairedTags.indexOf(o2) !== -1 ? this.options.suppressUnpairedNode || (i = "/") : this.options.suppressEmptyNode ? i = "/" : i = `></${o2}`, i;
    }, T2.prototype.buildTextValNode = function(o2, i, u, t) {
      if (this.options.cdataPropName !== false && i === this.options.cdataPropName) return this.indentate(t) + `<![CDATA[${o2}]]>` + this.newLine;
      if (this.options.commentPropName !== false && i === this.options.commentPropName) return this.indentate(t) + `<!--${o2}-->` + this.newLine;
      if (i[0] === "?") return this.indentate(t) + "<" + i + u + "?" + this.tagEndChar;
      {
        let e = this.options.tagValueProcessor(i, o2);
        return e = this.replaceEntitiesValue(e), e === "" ? this.indentate(t) + "<" + i + u + this.closeTag(i) + this.tagEndChar : this.indentate(t) + "<" + i + u + ">" + e + "</" + i + this.tagEndChar;
      }
    }, T2.prototype.replaceEntitiesValue = function(o2) {
      if (o2 && o2.length > 0 && this.options.processEntities) for (let i = 0; i < this.options.entities.length; i++) {
        const u = this.options.entities[i];
        o2 = o2.replace(u.regex, u.val);
      }
      return o2;
    };
    function V3(o2) {
      return this.options.indentBy.repeat(o2);
    }
    function I2(o2) {
      return o2.startsWith(this.options.attributeNamePrefix) && o2 !== this.options.textNodeName ? o2.substr(this.attrPrefixLen) : false;
    }
    return W = T2, W;
  }
  var K2;
  var ue2;
  function Te2() {
    if (ue2) return K2;
    ue2 = 1;
    const y2 = H2(), v3 = Ne2(), T2 = Ee2();
    return K2 = { XMLParser: v3, XMLValidator: y2, XMLBuilder: T2 }, K2;
  }
  var F2 = Te2();
  var ye2 = F2.XMLBuilder;
  var me2 = F2.XMLParser;
  var Pe2 = F2.XMLValidator;

  // js/vendor/jsonpath-plus.mjs
  function ne3(e, t, r) {
    return t = S2(t), le3(e, M3() ? Reflect.construct(t, r || [], S2(e).constructor) : t.apply(e, r));
  }
  function J3(e, t, r) {
    if (M3()) return Reflect.construct.apply(null, arguments);
    var n = [null];
    n.push.apply(n, t);
    var o2 = new (e.bind.apply(e, n))();
    return r && k3(o2, r.prototype), o2;
  }
  function M3() {
    try {
      var e = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
      }));
    } catch {
    }
    return (M3 = function() {
      return !!e;
    })();
  }
  function Q2(e, t) {
    var r = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var n = Object.getOwnPropertySymbols(e);
      t && (n = n.filter(function(o2) {
        return Object.getOwnPropertyDescriptor(e, o2).enumerable;
      })), r.push.apply(r, n);
    }
    return r;
  }
  function ie2(e) {
    for (var t = 1; t < arguments.length; t++) {
      var r = arguments[t] != null ? arguments[t] : {};
      t % 2 ? Q2(Object(r), true).forEach(function(n) {
        ue3(e, n, r[n]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) : Q2(Object(r)).forEach(function(n) {
        Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(r, n));
      });
    }
    return e;
  }
  function oe2(e, t) {
    if (typeof e != "object" || !e) return e;
    var r = e[Symbol.toPrimitive];
    if (r !== void 0) {
      var n = r.call(e, t);
      if (typeof n != "object") return n;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return String(e);
  }
  function Y3(e) {
    var t = oe2(e, "string");
    return typeof t == "symbol" ? t : t + "";
  }
  function g(e) {
    "@babel/helpers - typeof";
    return g = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
      return typeof t;
    } : function(t) {
      return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
    }, g(e);
  }
  function C2(e, t) {
    if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function");
  }
  function q3(e, t) {
    for (var r = 0; r < t.length; r++) {
      var n = t[r];
      n.enumerable = n.enumerable || false, n.configurable = true, "value" in n && (n.writable = true), Object.defineProperty(e, Y3(n.key), n);
    }
  }
  function w(e, t, r) {
    return t && q3(e.prototype, t), r && q3(e, r), Object.defineProperty(e, "prototype", { writable: false }), e;
  }
  function ue3(e, t, r) {
    return t = Y3(t), t in e ? Object.defineProperty(e, t, { value: r, enumerable: true, configurable: true, writable: true }) : e[t] = r, e;
  }
  function ae3(e, t) {
    if (typeof t != "function" && t !== null) throw new TypeError("Super expression must either be null or a function");
    e.prototype = Object.create(t && t.prototype, { constructor: { value: e, writable: true, configurable: true } }), Object.defineProperty(e, "prototype", { writable: false }), t && k3(e, t);
  }
  function S2(e) {
    return S2 = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(r) {
      return r.__proto__ || Object.getPrototypeOf(r);
    }, S2(e);
  }
  function k3(e, t) {
    return k3 = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(n, o2) {
      return n.__proto__ = o2, n;
    }, k3(e, t);
  }
  function se3(e) {
    try {
      return Function.toString.call(e).indexOf("[native code]") !== -1;
    } catch {
      return typeof e == "function";
    }
  }
  function U3(e) {
    var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
    return U3 = function(n) {
      if (n === null || !se3(n)) return n;
      if (typeof n != "function") throw new TypeError("Super expression must either be null or a function");
      if (typeof t < "u") {
        if (t.has(n)) return t.get(n);
        t.set(n, o2);
      }
      function o2() {
        return J3(n, arguments, S2(this).constructor);
      }
      return o2.prototype = Object.create(n.prototype, { constructor: { value: o2, enumerable: false, writable: true, configurable: true } }), k3(o2, n);
    }, U3(e);
  }
  function ce3(e) {
    if (e === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    return e;
  }
  function le3(e, t) {
    if (t && (typeof t == "object" || typeof t == "function")) return t;
    if (t !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
    return ce3(e);
  }
  function j3(e) {
    return he3(e) || fe2(e) || G2(e) || pe3();
  }
  function he3(e) {
    if (Array.isArray(e)) return $2(e);
  }
  function fe2(e) {
    if (typeof Symbol < "u" && e[Symbol.iterator] != null || e["@@iterator"] != null) return Array.from(e);
  }
  function G2(e, t) {
    if (e) {
      if (typeof e == "string") return $2(e, t);
      var r = Object.prototype.toString.call(e).slice(8, -1);
      if (r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set") return Array.from(e);
      if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return $2(e, t);
    }
  }
  function $2(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = new Array(t); r < t; r++) n[r] = e[r];
    return n;
  }
  function pe3() {
    throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  function de3(e, t) {
    var r = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (!r) {
      if (Array.isArray(e) || (r = G2(e)) || t) {
        r && (e = r);
        var n = 0, o2 = function() {
        };
        return { s: o2, n: function() {
          return n >= e.length ? { done: true } : { done: false, value: e[n++] };
        }, e: function(a3) {
          throw a3;
        }, f: o2 };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var i = true, u = false, s;
    return { s: function() {
      r = r.call(e);
    }, n: function() {
      var a3 = r.next();
      return i = a3.done, a3;
    }, e: function(a3) {
      u = true, s = a3;
    }, f: function() {
      try {
        !i && r.return != null && r.return();
      } finally {
        if (u) throw s;
      }
    } };
  }
  var ye3 = (function() {
    function e() {
      C2(this, e);
    }
    return w(e, [{ key: "add", value: function(r, n, o2) {
      if (typeof arguments[0] != "string") for (var i in arguments[0]) this.add(i, arguments[0][i], arguments[1]);
      else (Array.isArray(r) ? r : [r]).forEach(function(u) {
        this[u] = this[u] || [], n && this[u][o2 ? "unshift" : "push"](n);
      }, this);
    } }, { key: "run", value: function(r, n) {
      this[r] = this[r] || [], this[r].forEach(function(o2) {
        o2.call(n && n.context ? n.context : n, n);
      });
    } }]);
  })();
  var be3 = (function() {
    function e(t) {
      C2(this, e), this.jsep = t, this.registered = {};
    }
    return w(e, [{ key: "register", value: function() {
      for (var r = this, n = arguments.length, o2 = new Array(n), i = 0; i < n; i++) o2[i] = arguments[i];
      o2.forEach(function(u) {
        if (g(u) !== "object" || !u.name || !u.init) throw new Error("Invalid JSEP plugin format");
        r.registered[u.name] || (u.init(r.jsep), r.registered[u.name] = u);
      });
    } }]);
  })();
  var E2 = (function() {
    function e(t) {
      C2(this, e), this.expr = t, this.index = 0;
    }
    return w(e, [{ key: "char", get: function() {
      return this.expr.charAt(this.index);
    } }, { key: "code", get: function() {
      return this.expr.charCodeAt(this.index);
    } }, { key: "throwError", value: function(r) {
      var n = new Error(r + " at character " + this.index);
      throw n.index = this.index, n.description = r, n;
    } }, { key: "runHook", value: function(r, n) {
      if (e.hooks[r]) {
        var o2 = { context: this, node: n };
        return e.hooks.run(r, o2), o2.node;
      }
      return n;
    } }, { key: "searchHook", value: function(r) {
      if (e.hooks[r]) {
        var n = { context: this };
        return e.hooks[r].find(function(o2) {
          return o2.call(n.context, n), n.node;
        }), n.node;
      }
    } }, { key: "gobbleSpaces", value: function() {
      for (var r = this.code; r === e.SPACE_CODE || r === e.TAB_CODE || r === e.LF_CODE || r === e.CR_CODE; ) r = this.expr.charCodeAt(++this.index);
      this.runHook("gobble-spaces");
    } }, { key: "parse", value: function() {
      this.runHook("before-all");
      var r = this.gobbleExpressions(), n = r.length === 1 ? r[0] : { type: e.COMPOUND, body: r };
      return this.runHook("after-all", n);
    } }, { key: "gobbleExpressions", value: function(r) {
      for (var n = [], o2, i; this.index < this.expr.length; ) if (o2 = this.code, o2 === e.SEMCOL_CODE || o2 === e.COMMA_CODE) this.index++;
      else if (i = this.gobbleExpression()) n.push(i);
      else if (this.index < this.expr.length) {
        if (o2 === r) break;
        this.throwError('Unexpected "' + this.char + '"');
      }
      return n;
    } }, { key: "gobbleExpression", value: function() {
      var r = this.searchHook("gobble-expression") || this.gobbleBinaryExpression();
      return this.gobbleSpaces(), this.runHook("after-expression", r);
    } }, { key: "gobbleBinaryOp", value: function() {
      this.gobbleSpaces();
      for (var r = this.expr.substr(this.index, e.max_binop_len), n = r.length; n > 0; ) {
        if (e.binary_ops.hasOwnProperty(r) && (!e.isIdentifierStart(this.code) || this.index + r.length < this.expr.length && !e.isIdentifierPart(this.expr.charCodeAt(this.index + r.length)))) return this.index += n, r;
        r = r.substr(0, --n);
      }
      return false;
    } }, { key: "gobbleBinaryExpression", value: function() {
      var r, n, o2, i, u, s, a3, l2, c;
      if (s = this.gobbleToken(), !s || (n = this.gobbleBinaryOp(), !n)) return s;
      for (u = { value: n, prec: e.binaryPrecedence(n), right_a: e.right_associative.has(n) }, a3 = this.gobbleToken(), a3 || this.throwError("Expected expression after " + n), i = [s, u, a3]; n = this.gobbleBinaryOp(); ) {
        if (o2 = e.binaryPrecedence(n), o2 === 0) {
          this.index -= n.length;
          break;
        }
        u = { value: n, prec: o2, right_a: e.right_associative.has(n) }, c = n;
        for (var h2 = function(b3) {
          return u.right_a && b3.right_a ? o2 > b3.prec : o2 <= b3.prec;
        }; i.length > 2 && h2(i[i.length - 2]); ) a3 = i.pop(), n = i.pop().value, s = i.pop(), r = { type: e.BINARY_EXP, operator: n, left: s, right: a3 }, i.push(r);
        r = this.gobbleToken(), r || this.throwError("Expected expression after " + c), i.push(u, r);
      }
      for (l2 = i.length - 1, r = i[l2]; l2 > 1; ) r = { type: e.BINARY_EXP, operator: i[l2 - 1].value, left: i[l2 - 2], right: r }, l2 -= 2;
      return r;
    } }, { key: "gobbleToken", value: function() {
      var r, n, o2, i;
      if (this.gobbleSpaces(), i = this.searchHook("gobble-token"), i) return this.runHook("after-token", i);
      if (r = this.code, e.isDecimalDigit(r) || r === e.PERIOD_CODE) return this.gobbleNumericLiteral();
      if (r === e.SQUOTE_CODE || r === e.DQUOTE_CODE) i = this.gobbleStringLiteral();
      else if (r === e.OBRACK_CODE) i = this.gobbleArray();
      else {
        for (n = this.expr.substr(this.index, e.max_unop_len), o2 = n.length; o2 > 0; ) {
          if (e.unary_ops.hasOwnProperty(n) && (!e.isIdentifierStart(this.code) || this.index + n.length < this.expr.length && !e.isIdentifierPart(this.expr.charCodeAt(this.index + n.length)))) {
            this.index += o2;
            var u = this.gobbleToken();
            return u || this.throwError("missing unaryOp argument"), this.runHook("after-token", { type: e.UNARY_EXP, operator: n, argument: u, prefix: true });
          }
          n = n.substr(0, --o2);
        }
        e.isIdentifierStart(r) ? (i = this.gobbleIdentifier(), e.literals.hasOwnProperty(i.name) ? i = { type: e.LITERAL, value: e.literals[i.name], raw: i.name } : i.name === e.this_str && (i = { type: e.THIS_EXP })) : r === e.OPAREN_CODE && (i = this.gobbleGroup());
      }
      return i ? (i = this.gobbleTokenProperty(i), this.runHook("after-token", i)) : this.runHook("after-token", false);
    } }, { key: "gobbleTokenProperty", value: function(r) {
      this.gobbleSpaces();
      for (var n = this.code; n === e.PERIOD_CODE || n === e.OBRACK_CODE || n === e.OPAREN_CODE || n === e.QUMARK_CODE; ) {
        var o2 = void 0;
        if (n === e.QUMARK_CODE) {
          if (this.expr.charCodeAt(this.index + 1) !== e.PERIOD_CODE) break;
          o2 = true, this.index += 2, this.gobbleSpaces(), n = this.code;
        }
        this.index++, n === e.OBRACK_CODE ? (r = { type: e.MEMBER_EXP, computed: true, object: r, property: this.gobbleExpression() }, this.gobbleSpaces(), n = this.code, n !== e.CBRACK_CODE && this.throwError("Unclosed ["), this.index++) : n === e.OPAREN_CODE ? r = { type: e.CALL_EXP, arguments: this.gobbleArguments(e.CPAREN_CODE), callee: r } : (n === e.PERIOD_CODE || o2) && (o2 && this.index--, this.gobbleSpaces(), r = { type: e.MEMBER_EXP, computed: false, object: r, property: this.gobbleIdentifier() }), o2 && (r.optional = true), this.gobbleSpaces(), n = this.code;
      }
      return r;
    } }, { key: "gobbleNumericLiteral", value: function() {
      for (var r = "", n, o2; e.isDecimalDigit(this.code); ) r += this.expr.charAt(this.index++);
      if (this.code === e.PERIOD_CODE) for (r += this.expr.charAt(this.index++); e.isDecimalDigit(this.code); ) r += this.expr.charAt(this.index++);
      if (n = this.char, n === "e" || n === "E") {
        for (r += this.expr.charAt(this.index++), n = this.char, (n === "+" || n === "-") && (r += this.expr.charAt(this.index++)); e.isDecimalDigit(this.code); ) r += this.expr.charAt(this.index++);
        e.isDecimalDigit(this.expr.charCodeAt(this.index - 1)) || this.throwError("Expected exponent (" + r + this.char + ")");
      }
      return o2 = this.code, e.isIdentifierStart(o2) ? this.throwError("Variable names cannot start with a number (" + r + this.char + ")") : (o2 === e.PERIOD_CODE || r.length === 1 && r.charCodeAt(0) === e.PERIOD_CODE) && this.throwError("Unexpected period"), { type: e.LITERAL, value: parseFloat(r), raw: r };
    } }, { key: "gobbleStringLiteral", value: function() {
      for (var r = "", n = this.index, o2 = this.expr.charAt(this.index++), i = false; this.index < this.expr.length; ) {
        var u = this.expr.charAt(this.index++);
        if (u === o2) {
          i = true;
          break;
        } else if (u === "\\") switch (u = this.expr.charAt(this.index++), u) {
          case "n":
            r += `
`;
            break;
          case "r":
            r += "\r";
            break;
          case "t":
            r += "	";
            break;
          case "b":
            r += "\b";
            break;
          case "f":
            r += "\f";
            break;
          case "v":
            r += "\v";
            break;
          default:
            r += u;
        }
        else r += u;
      }
      return i || this.throwError('Unclosed quote after "' + r + '"'), { type: e.LITERAL, value: r, raw: this.expr.substring(n, this.index) };
    } }, { key: "gobbleIdentifier", value: function() {
      var r = this.code, n = this.index;
      for (e.isIdentifierStart(r) ? this.index++ : this.throwError("Unexpected " + this.char); this.index < this.expr.length && (r = this.code, e.isIdentifierPart(r)); ) this.index++;
      return { type: e.IDENTIFIER, name: this.expr.slice(n, this.index) };
    } }, { key: "gobbleArguments", value: function(r) {
      for (var n = [], o2 = false, i = 0; this.index < this.expr.length; ) {
        this.gobbleSpaces();
        var u = this.code;
        if (u === r) {
          o2 = true, this.index++, r === e.CPAREN_CODE && i && i >= n.length && this.throwError("Unexpected token " + String.fromCharCode(r));
          break;
        } else if (u === e.COMMA_CODE) {
          if (this.index++, i++, i !== n.length) {
            if (r === e.CPAREN_CODE) this.throwError("Unexpected token ,");
            else if (r === e.CBRACK_CODE) for (var s = n.length; s < i; s++) n.push(null);
          }
        } else if (n.length !== i && i !== 0) this.throwError("Expected comma");
        else {
          var a3 = this.gobbleExpression();
          (!a3 || a3.type === e.COMPOUND) && this.throwError("Expected comma"), n.push(a3);
        }
      }
      return o2 || this.throwError("Expected " + String.fromCharCode(r)), n;
    } }, { key: "gobbleGroup", value: function() {
      this.index++;
      var r = this.gobbleExpressions(e.CPAREN_CODE);
      if (this.code === e.CPAREN_CODE) return this.index++, r.length === 1 ? r[0] : r.length ? { type: e.SEQUENCE_EXP, expressions: r } : false;
      this.throwError("Unclosed (");
    } }, { key: "gobbleArray", value: function() {
      return this.index++, { type: e.ARRAY_EXP, elements: this.gobbleArguments(e.CBRACK_CODE) };
    } }], [{ key: "version", get: function() {
      return "1.3.8";
    } }, { key: "toString", value: function() {
      return "JavaScript Expression Parser (JSEP) v" + e.version;
    } }, { key: "addUnaryOp", value: function(r) {
      return e.max_unop_len = Math.max(r.length, e.max_unop_len), e.unary_ops[r] = 1, e;
    } }, { key: "addBinaryOp", value: function(r, n, o2) {
      return e.max_binop_len = Math.max(r.length, e.max_binop_len), e.binary_ops[r] = n, o2 ? e.right_associative.add(r) : e.right_associative.delete(r), e;
    } }, { key: "addIdentifierChar", value: function(r) {
      return e.additional_identifier_chars.add(r), e;
    } }, { key: "addLiteral", value: function(r, n) {
      return e.literals[r] = n, e;
    } }, { key: "removeUnaryOp", value: function(r) {
      return delete e.unary_ops[r], r.length === e.max_unop_len && (e.max_unop_len = e.getMaxKeyLen(e.unary_ops)), e;
    } }, { key: "removeAllUnaryOps", value: function() {
      return e.unary_ops = {}, e.max_unop_len = 0, e;
    } }, { key: "removeIdentifierChar", value: function(r) {
      return e.additional_identifier_chars.delete(r), e;
    } }, { key: "removeBinaryOp", value: function(r) {
      return delete e.binary_ops[r], r.length === e.max_binop_len && (e.max_binop_len = e.getMaxKeyLen(e.binary_ops)), e.right_associative.delete(r), e;
    } }, { key: "removeAllBinaryOps", value: function() {
      return e.binary_ops = {}, e.max_binop_len = 0, e;
    } }, { key: "removeLiteral", value: function(r) {
      return delete e.literals[r], e;
    } }, { key: "removeAllLiterals", value: function() {
      return e.literals = {}, e;
    } }, { key: "parse", value: function(r) {
      return new e(r).parse();
    } }, { key: "getMaxKeyLen", value: function(r) {
      return Math.max.apply(Math, [0].concat(j3(Object.keys(r).map(function(n) {
        return n.length;
      }))));
    } }, { key: "isDecimalDigit", value: function(r) {
      return r >= 48 && r <= 57;
    } }, { key: "binaryPrecedence", value: function(r) {
      return e.binary_ops[r] || 0;
    } }, { key: "isIdentifierStart", value: function(r) {
      return r >= 65 && r <= 90 || r >= 97 && r <= 122 || r >= 128 && !e.binary_ops[String.fromCharCode(r)] || e.additional_identifier_chars.has(String.fromCharCode(r));
    } }, { key: "isIdentifierPart", value: function(r) {
      return e.isIdentifierStart(r) || e.isDecimalDigit(r);
    } }]);
  })();
  var ve2 = new ye3();
  Object.assign(E2, { hooks: ve2, plugins: new be3(E2), COMPOUND: "Compound", SEQUENCE_EXP: "SequenceExpression", IDENTIFIER: "Identifier", MEMBER_EXP: "MemberExpression", LITERAL: "Literal", THIS_EXP: "ThisExpression", CALL_EXP: "CallExpression", UNARY_EXP: "UnaryExpression", BINARY_EXP: "BinaryExpression", ARRAY_EXP: "ArrayExpression", TAB_CODE: 9, LF_CODE: 10, CR_CODE: 13, SPACE_CODE: 32, PERIOD_CODE: 46, COMMA_CODE: 44, SQUOTE_CODE: 39, DQUOTE_CODE: 34, OPAREN_CODE: 40, CPAREN_CODE: 41, OBRACK_CODE: 91, CBRACK_CODE: 93, QUMARK_CODE: 63, SEMCOL_CODE: 59, COLON_CODE: 58, unary_ops: { "-": 1, "!": 1, "~": 1, "+": 1 }, binary_ops: { "||": 1, "&&": 2, "|": 3, "^": 4, "&": 5, "==": 6, "!=": 6, "===": 6, "!==": 6, "<": 7, ">": 7, "<=": 7, ">=": 7, "<<": 8, ">>": 8, ">>>": 8, "+": 9, "-": 9, "*": 10, "/": 10, "%": 10 }, right_associative: /* @__PURE__ */ new Set(), additional_identifier_chars: /* @__PURE__ */ new Set(["$", "_"]), literals: { true: true, false: false, null: null }, this_str: "this" }), E2.max_unop_len = E2.getMaxKeyLen(E2.unary_ops), E2.max_binop_len = E2.getMaxKeyLen(E2.binary_ops);
  var A2 = function(t) {
    return new E2(t).parse();
  };
  var ge3 = Object.getOwnPropertyNames(E2);
  ge3.forEach(function(e) {
    A2[e] === void 0 && e !== "prototype" && (A2[e] = E2[e]);
  }), A2.Jsep = E2;
  var Ee3 = "ConditionalExpression";
  var _e2 = { name: "ternary", init: function(t) {
    t.hooks.add("after-expression", function(n) {
      if (n.node && this.code === t.QUMARK_CODE) {
        this.index++;
        var o2 = n.node, i = this.gobbleExpression();
        if (i || this.throwError("Expected expression"), this.gobbleSpaces(), this.code === t.COLON_CODE) {
          this.index++;
          var u = this.gobbleExpression();
          if (u || this.throwError("Expected expression"), n.node = { type: Ee3, test: o2, consequent: i, alternate: u }, o2.operator && t.binary_ops[o2.operator] <= 0.9) {
            for (var s = o2; s.right.operator && t.binary_ops[s.right.operator] <= 0.9; ) s = s.right;
            n.node.test = s.right, s.right = n.node, n.node = o2;
          }
        } else this.throwError("Expected :");
      }
    });
  } };
  A2.plugins.register(_e2);
  var V2 = 47;
  var Fe2 = 92;
  var De2 = { name: "regex", init: function(t) {
    t.hooks.add("gobble-token", function(n) {
      if (this.code === V2) {
        for (var o2 = ++this.index, i = false; this.index < this.expr.length; ) {
          if (this.code === V2 && !i) {
            for (var u = this.expr.slice(o2, this.index), s = ""; ++this.index < this.expr.length; ) {
              var a3 = this.code;
              if (a3 >= 97 && a3 <= 122 || a3 >= 65 && a3 <= 90 || a3 >= 48 && a3 <= 57) s += this.char;
              else break;
            }
            var l2 = void 0;
            try {
              l2 = new RegExp(u, s);
            } catch (c) {
              this.throwError(c.message);
            }
            return n.node = { type: t.LITERAL, value: l2, raw: this.expr.slice(o2 - 1, this.index) }, n.node = this.gobbleTokenProperty(n.node), n.node;
          }
          this.code === t.OBRACK_CODE ? i = true : i && this.code === t.CBRACK_CODE && (i = false), this.index += this.code === Fe2 ? 2 : 1;
        }
        this.throwError("Unclosed Regex");
      }
    });
  } };
  var K3 = 43;
  var xe2 = 45;
  var m3 = { name: "assignment", assignmentOperators: /* @__PURE__ */ new Set(["=", "*=", "**=", "/=", "%=", "+=", "-=", "<<=", ">>=", ">>>=", "&=", "^=", "|="]), updateOperators: [K3, xe2], assignmentPrecedence: 0.9, init: function(t) {
    var r = [t.IDENTIFIER, t.MEMBER_EXP];
    m3.assignmentOperators.forEach(function(o2) {
      return t.addBinaryOp(o2, m3.assignmentPrecedence, true);
    }), t.hooks.add("gobble-token", function(i) {
      var u = this, s = this.code;
      m3.updateOperators.some(function(a3) {
        return a3 === s && a3 === u.expr.charCodeAt(u.index + 1);
      }) && (this.index += 2, i.node = { type: "UpdateExpression", operator: s === K3 ? "++" : "--", argument: this.gobbleTokenProperty(this.gobbleIdentifier()), prefix: true }, (!i.node.argument || !r.includes(i.node.argument.type)) && this.throwError("Unexpected ".concat(i.node.operator)));
    }), t.hooks.add("after-token", function(i) {
      var u = this;
      if (i.node) {
        var s = this.code;
        m3.updateOperators.some(function(a3) {
          return a3 === s && a3 === u.expr.charCodeAt(u.index + 1);
        }) && (r.includes(i.node.type) || this.throwError("Unexpected ".concat(i.node.operator)), this.index += 2, i.node = { type: "UpdateExpression", operator: s === K3 ? "++" : "--", argument: i.node, prefix: false });
      }
    }), t.hooks.add("after-expression", function(i) {
      i.node && n(i.node);
    });
    function n(o2) {
      m3.assignmentOperators.has(o2.operator) ? (o2.type = "AssignmentExpression", n(o2.left), n(o2.right)) : o2.operator || Object.values(o2).forEach(function(i) {
        i && g(i) === "object" && n(i);
      });
    }
  } };
  var v2 = Object.prototype.hasOwnProperty;
  function D2(e, t) {
    return e = e.slice(), e.push(t), e;
  }
  function H3(e, t) {
    return t = t.slice(), t.unshift(e), t;
  }
  var Oe2 = (function(e) {
    function t(r) {
      var n;
      return C2(this, t), n = ne3(this, t, ['JSONPath should not be called with "new" (it prevents return of (unwrapped) scalar values)']), n.avoidNew = true, n.value = r, n.name = "NewError", n;
    }
    return ae3(t, e), w(t);
  })(U3(Error));
  function f2(e, t, r, n, o2) {
    if (!(this instanceof f2)) try {
      return new f2(e, t, r, n, o2);
    } catch (a3) {
      if (!a3.avoidNew) throw a3;
      return a3.value;
    }
    typeof e == "string" && (o2 = n, n = r, r = t, t = e, e = null);
    var i = e && g(e) === "object";
    if (e = e || {}, this.json = e.json || r, this.path = e.path || t, this.resultType = e.resultType || "value", this.flatten = e.flatten || false, this.wrap = v2.call(e, "wrap") ? e.wrap : true, this.sandbox = e.sandbox || {}, this.eval = e.eval === void 0 ? "safe" : e.eval, this.ignoreEvalErrors = typeof e.ignoreEvalErrors > "u" ? false : e.ignoreEvalErrors, this.parent = e.parent || null, this.parentProperty = e.parentProperty || null, this.callback = e.callback || n || null, this.otherTypeCallback = e.otherTypeCallback || o2 || function() {
      throw new TypeError("You must supply an otherTypeCallback callback option with the @other() operator.");
    }, e.autostart !== false) {
      var u = { path: i ? e.path : t };
      i ? "json" in e && (u.json = e.json) : u.json = r;
      var s = this.evaluate(u);
      if (!s || g(s) !== "object") throw new Oe2(s);
      return s;
    }
  }
  f2.prototype.evaluate = function(e, t, r, n) {
    var o2 = this, i = this.parent, u = this.parentProperty, s = this.flatten, a3 = this.wrap;
    if (this.currResultType = this.resultType, this.currEval = this.eval, this.currSandbox = this.sandbox, r = r || this.callback, this.currOtherTypeCallback = n || this.otherTypeCallback, t = t || this.json, e = e || this.path, e && g(e) === "object" && !Array.isArray(e)) {
      if (!e.path && e.path !== "") throw new TypeError('You must supply a "path" property when providing an object argument to JSONPath.evaluate().');
      if (!v2.call(e, "json")) throw new TypeError('You must supply a "json" property when providing an object argument to JSONPath.evaluate().');
      var l2 = e;
      t = l2.json, s = v2.call(e, "flatten") ? e.flatten : s, this.currResultType = v2.call(e, "resultType") ? e.resultType : this.currResultType, this.currSandbox = v2.call(e, "sandbox") ? e.sandbox : this.currSandbox, a3 = v2.call(e, "wrap") ? e.wrap : a3, this.currEval = v2.call(e, "eval") ? e.eval : this.currEval, r = v2.call(e, "callback") ? e.callback : r, this.currOtherTypeCallback = v2.call(e, "otherTypeCallback") ? e.otherTypeCallback : this.currOtherTypeCallback, i = v2.call(e, "parent") ? e.parent : i, u = v2.call(e, "parentProperty") ? e.parentProperty : u, e = e.path;
    }
    if (i = i || null, u = u || null, Array.isArray(e) && (e = f2.toPathString(e)), !(!e && e !== "" || !t)) {
      var c = f2.toPathArray(e);
      c[0] === "$" && c.length > 1 && c.shift(), this._hasParentSelector = null;
      var h2 = this._trace(c, t, ["$"], i, u, r).filter(function(p) {
        return p && !p.isParentSelector;
      });
      return h2.length ? !a3 && h2.length === 1 && !h2[0].hasArrExpr ? this._getPreferredOutput(h2[0]) : h2.reduce(function(p, b3) {
        var F3 = o2._getPreferredOutput(b3);
        return s && Array.isArray(F3) ? p = p.concat(F3) : p.push(F3), p;
      }, []) : a3 ? [] : void 0;
    }
  }, f2.prototype._getPreferredOutput = function(e) {
    var t = this.currResultType;
    switch (t) {
      case "all": {
        var r = Array.isArray(e.path) ? e.path : f2.toPathArray(e.path);
        return e.pointer = f2.toPointer(r), e.path = typeof e.path == "string" ? e.path : f2.toPathString(e.path), e;
      }
      case "value":
      case "parent":
      case "parentProperty":
        return e[t];
      case "path":
        return f2.toPathString(e[t]);
      case "pointer":
        return f2.toPointer(e.path);
      default:
        throw new TypeError("Unknown result type");
    }
  }, f2.prototype._handleCallback = function(e, t, r) {
    if (t) {
      var n = this._getPreferredOutput(e);
      e.path = typeof e.path == "string" ? e.path : f2.toPathString(e.path), t(n, r, e);
    }
  }, f2.prototype._trace = function(e, t, r, n, o2, i, u, s) {
    var a3 = this, l2;
    if (!e.length) return l2 = { path: r, value: t, parent: n, parentProperty: o2, hasArrExpr: u }, this._handleCallback(l2, i, "value"), l2;
    var c = e[0], h2 = e.slice(1), p = [];
    function b3(y2) {
      Array.isArray(y2) ? y2.forEach(function(L3) {
        p.push(L3);
      }) : p.push(y2);
    }
    if ((typeof c != "string" || s) && t && v2.call(t, c)) b3(this._trace(h2, t[c], D2(r, c), t, c, i, u));
    else if (c === "*") this._walk(t, function(y2) {
      b3(a3._trace(h2, t[y2], D2(r, y2), t, y2, i, true, true));
    });
    else if (c === "..") b3(this._trace(h2, t, r, n, o2, i, u)), this._walk(t, function(y2) {
      g(t[y2]) === "object" && b3(a3._trace(e.slice(), t[y2], D2(r, y2), t, y2, i, true));
    });
    else {
      if (c === "^") return this._hasParentSelector = true, { path: r.slice(0, -1), expr: h2, isParentSelector: true };
      if (c === "~") return l2 = { path: D2(r, c), value: o2, parent: n, parentProperty: null }, this._handleCallback(l2, i, "property"), l2;
      if (c === "$") b3(this._trace(h2, t, r, null, null, i, u));
      else if (/^(\x2D?[0-9]*):(\x2D?[0-9]*):?([0-9]*)$/.test(c)) b3(this._slice(c, h2, t, r, n, o2, i));
      else if (c.indexOf("?(") === 0) {
        if (this.currEval === false) throw new Error("Eval [?(expr)] prevented in JSONPath expression.");
        var F3 = c.replace(/^\?\(((?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*?)\)$/, "$1"), O = /@(?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])?((?:[\0->@-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*)['\[](\??\((?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*?\))(?!(?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])\)\])['\]]/g.exec(F3);
        O ? this._walk(t, function(y2) {
          var L3 = [O[2]], re3 = O[1] ? t[y2][O[1]] : t[y2], te3 = a3._trace(L3, re3, r, n, o2, i, true);
          te3.length > 0 && b3(a3._trace(h2, t[y2], D2(r, y2), t, y2, i, true));
        }) : this._walk(t, function(y2) {
          a3._eval(F3, t[y2], y2, r, n, o2) && b3(a3._trace(h2, t[y2], D2(r, y2), t, y2, i, true));
        });
      } else if (c[0] === "(") {
        if (this.currEval === false) throw new Error("Eval [(expr)] prevented in JSONPath expression.");
        b3(this._trace(H3(this._eval(c, t, r[r.length - 1], r.slice(0, -1), n, o2), h2), t, r, n, o2, i, u));
      } else if (c[0] === "@") {
        var _2 = false, B3 = c.slice(1, -2);
        switch (B3) {
          case "scalar":
            (!t || !["object", "function"].includes(g(t))) && (_2 = true);
            break;
          case "boolean":
          case "string":
          case "undefined":
          case "function":
            g(t) === B3 && (_2 = true);
            break;
          case "integer":
            Number.isFinite(t) && !(t % 1) && (_2 = true);
            break;
          case "number":
            Number.isFinite(t) && (_2 = true);
            break;
          case "nonFinite":
            typeof t == "number" && !Number.isFinite(t) && (_2 = true);
            break;
          case "object":
            t && g(t) === B3 && (_2 = true);
            break;
          case "array":
            Array.isArray(t) && (_2 = true);
            break;
          case "other":
            _2 = this.currOtherTypeCallback(t, r, n, o2);
            break;
          case "null":
            t === null && (_2 = true);
            break;
          default:
            throw new TypeError("Unknown value type " + B3);
        }
        if (_2) return l2 = { path: r, value: t, parent: n, parentProperty: o2 }, this._handleCallback(l2, i, "value"), l2;
      } else if (c[0] === "`" && t && v2.call(t, c.slice(1))) {
        var T2 = c.slice(1);
        b3(this._trace(h2, t[T2], D2(r, T2), t, T2, i, u, true));
      } else if (c.includes(",")) {
        var W2 = c.split(","), I2 = de3(W2), X2;
        try {
          for (I2.s(); !(X2 = I2.n()).done; ) {
            var Z2 = X2.value;
            b3(this._trace(H3(Z2, h2), t, r, n, o2, i, true));
          }
        } catch (y2) {
          I2.e(y2);
        } finally {
          I2.f();
        }
      } else !s && t && v2.call(t, c) && b3(this._trace(h2, t[c], D2(r, c), t, c, i, u, true));
    }
    if (this._hasParentSelector) for (var x = 0; x < p.length; x++) {
      var R3 = p[x];
      if (R3 && R3.isParentSelector) {
        var P2 = this._trace(R3.expr, t, R3.path, n, o2, i, u);
        if (Array.isArray(P2)) {
          p[x] = P2[0];
          for (var ee3 = P2.length, N2 = 1; N2 < ee3; N2++) x++, p.splice(x, 0, P2[N2]);
        } else p[x] = P2;
      }
    }
    return p;
  }, f2.prototype._walk = function(e, t) {
    if (Array.isArray(e)) for (var r = e.length, n = 0; n < r; n++) t(n);
    else e && g(e) === "object" && Object.keys(e).forEach(function(o2) {
      t(o2);
    });
  }, f2.prototype._slice = function(e, t, r, n, o2, i, u) {
    if (Array.isArray(r)) {
      var s = r.length, a3 = e.split(":"), l2 = a3[2] && Number.parseInt(a3[2]) || 1, c = a3[0] && Number.parseInt(a3[0]) || 0, h2 = a3[1] && Number.parseInt(a3[1]) || s;
      c = c < 0 ? Math.max(0, c + s) : Math.min(s, c), h2 = h2 < 0 ? Math.max(0, h2 + s) : Math.min(s, h2);
      for (var p = [], b3 = c; b3 < h2; b3 += l2) {
        var F3 = this._trace(H3(b3, t), r, n, o2, i, u, true);
        F3.forEach(function(O) {
          p.push(O);
        });
      }
      return p;
    }
  }, f2.prototype._eval = function(e, t, r, n, o2, i) {
    var u = this;
    this.currSandbox._$_parentProperty = i, this.currSandbox._$_parent = o2, this.currSandbox._$_property = r, this.currSandbox._$_root = this.json, this.currSandbox._$_v = t;
    var s = e.includes("@path");
    s && (this.currSandbox._$_path = f2.toPathString(n.concat([r])));
    var a3 = this.currEval + "Script:" + e;
    if (!f2.cache[a3]) {
      var l2 = e.replace(/@parentProperty/g, "_$_parentProperty").replace(/@parent/g, "_$_parent").replace(/@property/g, "_$_property").replace(/@root/g, "_$_root").replace(/@([\t-\r \)\.\[\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF])/g, "_$_v$1");
      if (s && (l2 = l2.replace(/@path/g, "_$_path")), this.currEval === "safe" || this.currEval === true || this.currEval === void 0) f2.cache[a3] = new this.safeVm.Script(l2);
      else if (this.currEval === "native") f2.cache[a3] = new this.vm.Script(l2);
      else if (typeof this.currEval == "function" && this.currEval.prototype && v2.call(this.currEval.prototype, "runInNewContext")) {
        var c = this.currEval;
        f2.cache[a3] = new c(l2);
      } else if (typeof this.currEval == "function") f2.cache[a3] = { runInNewContext: function(p) {
        return u.currEval(l2, p);
      } };
      else throw new TypeError('Unknown "eval" property "'.concat(this.currEval, '"'));
    }
    try {
      return f2.cache[a3].runInNewContext(this.currSandbox);
    } catch (h2) {
      if (this.ignoreEvalErrors) return false;
      throw new Error("jsonPath: " + h2.message + ": " + e);
    }
  }, f2.cache = {}, f2.toPathString = function(e) {
    for (var t = e, r = t.length, n = "$", o2 = 1; o2 < r; o2++) /^(~|\^|@(?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*?\(\))$/.test(t[o2]) || (n += /^[\*0-9]+$/.test(t[o2]) ? "[" + t[o2] + "]" : "['" + t[o2] + "']");
    return n;
  }, f2.toPointer = function(e) {
    for (var t = e, r = t.length, n = "", o2 = 1; o2 < r; o2++) /^(~|\^|@(?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*?\(\))$/.test(t[o2]) || (n += "/" + t[o2].toString().replace(/~/g, "~0").replace(/\//g, "~1"));
    return n;
  }, f2.toPathArray = function(e) {
    var t = f2.cache;
    if (t[e]) return t[e].concat();
    var r = [], n = e.replace(/@(?:null|boolean|number|string|integer|undefined|nonFinite|scalar|array|object|function|other)\(\)/g, ";$&;").replace(/['\[](\??\((?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*?\))['\]](?!(?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])\])/g, function(i, u) {
      return "[#" + (r.push(u) - 1) + "]";
    }).replace(/\[["']((?:[\0-&\(-\\\^-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*)["']\]/g, function(i, u) {
      return "['" + u.replace(/\./g, "%@%").replace(/~/g, "%%@@%%") + "']";
    }).replace(/~/g, ";~;").replace(/["']?\.["']?(?!(?:[\0-Z\\-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*\])|\[["']?/g, ";").replace(/%@%/g, ".").replace(/%%@@%%/g, "~").replace(/(?:;)?(\^+)(?:;)?/g, function(i, u) {
      return ";" + u.split("").join(";") + ";";
    }).replace(/;;;|;;/g, ";..;").replace(/;$|'?\]|'$/g, ""), o2 = n.split(";").map(function(i) {
      var u = i.match(/#([0-9]+)/);
      return !u || !u[1] ? i : r[u[1]];
    });
    return t[e] = o2, t[e].concat();
  };
  var Ce2 = function(t, r, n) {
    for (var o2 = t.length, i = 0; i < o2; i++) {
      var u = t[i];
      n(u) && r.push(t.splice(i--, 1)[0]);
    }
  };
  A2.plugins.register(De2, m3);
  var d = { evalAst: function(t, r) {
    switch (t.type) {
      case "BinaryExpression":
      case "LogicalExpression":
        return d.evalBinaryExpression(t, r);
      case "Compound":
        return d.evalCompound(t, r);
      case "ConditionalExpression":
        return d.evalConditionalExpression(t, r);
      case "Identifier":
        return d.evalIdentifier(t, r);
      case "Literal":
        return d.evalLiteral(t, r);
      case "MemberExpression":
        return d.evalMemberExpression(t, r);
      case "UnaryExpression":
        return d.evalUnaryExpression(t, r);
      case "ArrayExpression":
        return d.evalArrayExpression(t, r);
      case "CallExpression":
        return d.evalCallExpression(t, r);
      case "AssignmentExpression":
        return d.evalAssignmentExpression(t, r);
      default:
        throw SyntaxError("Unexpected expression", t);
    }
  }, evalBinaryExpression: function(t, r) {
    var n = { "||": function(i, u) {
      return i || u();
    }, "&&": function(i, u) {
      return i && u();
    }, "|": function(i, u) {
      return i | u();
    }, "^": function(i, u) {
      return i ^ u();
    }, "&": function(i, u) {
      return i & u();
    }, "==": function(i, u) {
      return i == u();
    }, "!=": function(i, u) {
      return i != u();
    }, "===": function(i, u) {
      return i === u();
    }, "!==": function(i, u) {
      return i !== u();
    }, "<": function(i, u) {
      return i < u();
    }, ">": function(i, u) {
      return i > u();
    }, "<=": function(i, u) {
      return i <= u();
    }, ">=": function(i, u) {
      return i >= u();
    }, "<<": function(i, u) {
      return i << u();
    }, ">>": function(i, u) {
      return i >> u();
    }, ">>>": function(i, u) {
      return i >>> u();
    }, "+": function(i, u) {
      return i + u();
    }, "-": function(i, u) {
      return i - u();
    }, "*": function(i, u) {
      return i * u();
    }, "/": function(i, u) {
      return i / u();
    }, "%": function(i, u) {
      return i % u();
    } }[t.operator](d.evalAst(t.left, r), function() {
      return d.evalAst(t.right, r);
    });
    return n;
  }, evalCompound: function(t, r) {
    for (var n, o2 = 0; o2 < t.body.length; o2++) {
      t.body[o2].type === "Identifier" && ["var", "let", "const"].includes(t.body[o2].name) && t.body[o2 + 1] && t.body[o2 + 1].type === "AssignmentExpression" && (o2 += 1);
      var i = t.body[o2];
      n = d.evalAst(i, r);
    }
    return n;
  }, evalConditionalExpression: function(t, r) {
    return d.evalAst(t.test, r) ? d.evalAst(t.consequent, r) : d.evalAst(t.alternate, r);
  }, evalIdentifier: function(t, r) {
    if (t.name in r) return r[t.name];
    throw ReferenceError("".concat(t.name, " is not defined"));
  }, evalLiteral: function(t) {
    return t.value;
  }, evalMemberExpression: function(t, r) {
    var n = t.computed ? d.evalAst(t.property) : t.property.name, o2 = d.evalAst(t.object, r), i = o2[n];
    return typeof i == "function" ? i.bind(o2) : i;
  }, evalUnaryExpression: function(t, r) {
    var n = { "-": function(i) {
      return -d.evalAst(i, r);
    }, "!": function(i) {
      return !d.evalAst(i, r);
    }, "~": function(i) {
      return ~d.evalAst(i, r);
    }, "+": function(i) {
      return +d.evalAst(i, r);
    } }[t.operator](t.argument);
    return n;
  }, evalArrayExpression: function(t, r) {
    return t.elements.map(function(n) {
      return d.evalAst(n, r);
    });
  }, evalCallExpression: function(t, r) {
    var n = t.arguments.map(function(i) {
      return d.evalAst(i, r);
    }), o2 = d.evalAst(t.callee, r);
    return o2.apply(void 0, j3(n));
  }, evalAssignmentExpression: function(t, r) {
    if (t.left.type !== "Identifier") throw SyntaxError("Invalid left-hand side in assignment");
    var n = t.left.name, o2 = d.evalAst(t.right, r);
    return r[n] = o2, r[n];
  } };
  var z3 = (function() {
    function e(t) {
      C2(this, e), this.code = t, this.ast = A2(this.code);
    }
    return w(e, [{ key: "runInNewContext", value: function(r) {
      var n = ie2({}, r);
      return d.evalAst(this.ast, n);
    } }]);
  })();
  var we2 = (function() {
    function e(t) {
      C2(this, e), this.code = t;
    }
    return w(e, [{ key: "runInNewContext", value: function(r) {
      var n = this.code, o2 = Object.keys(r), i = [];
      Ce2(o2, i, function(c) {
        return typeof r[c] == "function";
      });
      var u = o2.map(function(c) {
        return r[c];
      }), s = i.reduce(function(c, h2) {
        var p = r[h2].toString();
        return /function/.test(p) || (p = "function " + p), "var " + h2 + "=" + p + ";" + c;
      }, "");
      n = s + n, !/(["'])use strict\1/.test(n) && !o2.includes("arguments") && (n = "var arguments = undefined;" + n), n = n.replace(/;[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*$/, "");
      var a3 = n.lastIndexOf(";"), l2 = a3 > -1 ? n.slice(0, a3 + 1) + " return " + n.slice(a3 + 1) : " return " + n;
      return J3(Function, o2.concat([l2])).apply(void 0, j3(u));
    } }]);
  })();
  f2.prototype.vm = { Script: we2 }, f2.prototype.safeVm = { Script: z3 };

  // js/vendor/lang-libs.mjs
  window.LIBS = {
    yaml: window.jsyaml,
    // 由 js-yaml.min.js (UMD) 注入全局
    tomlParse: yr,
    tomlStringify: _r,
    XMLParser: me2,
    XMLBuilder: ye2,
    JSONPath: f2
  };
  window.LIBS_ready = true;
  document.dispatchEvent(new CustomEvent("libsready"));
})();
