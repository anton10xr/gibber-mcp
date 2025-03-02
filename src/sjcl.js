import sjcl from "sjcl";

sjcl.bn = function (it) {
  this.initWith(it);
};

sjcl.bn.prototype = {
  radix: 24,
  maxMul: 8,
  _class: sjcl.bn,

  copy: function () {
    return new this._class(this);
  },

  /**
   * Initializes this with it, either as a bn, a number, or a hex string.
   */
  initWith: function (it) {
    var i = 0,
      k;
    switch (typeof it) {
      case "object":
        this.limbs = it.limbs.slice(0);
        break;

      case "number":
        this.limbs = [it];
        this.normalize();
        break;

      case "string":
        it = it.replace(/^0x/, "");
        this.limbs = [];
        // hack
        k = this.radix / 4;
        for (i = 0; i < it.length; i += k) {
          this.limbs.push(
            parseInt(
              it.substring(Math.max(it.length - i - k, 0), it.length - i),
              16
            )
          );
        }
        break;

      default:
        this.limbs = [0];
    }
    return this;
  },

  /**
   * Returns true if "this" and "that" are equal.  Calls fullReduce().
   * Equality test is in constant time.
   */
  equals: function (that) {
    if (typeof that === "number") {
      that = new this._class(that);
    }
    var difference = 0,
      i;
    this.fullReduce();
    that.fullReduce();
    for (i = 0; i < this.limbs.length || i < that.limbs.length; i++) {
      difference |= this.getLimb(i) ^ that.getLimb(i);
    }
    return difference === 0;
  },

  /**
   * Get the i'th limb of this, zero if i is too large.
   */
  getLimb: function (i) {
    return i >= this.limbs.length ? 0 : this.limbs[i];
  },

  /**
   * Constant time comparison function.
   * Returns 1 if this >= that, or zero otherwise.
   */
  greaterEquals: function (that) {
    if (typeof that === "number") {
      that = new this._class(that);
    }
    var less = 0,
      greater = 0,
      i,
      a,
      b;
    i = Math.max(this.limbs.length, that.limbs.length) - 1;
    for (; i >= 0; i--) {
      a = this.getLimb(i);
      b = that.getLimb(i);
      greater |= (b - a) & ~less;
      less |= (a - b) & ~greater;
    }
    return (greater | ~less) >>> 31;
  },

  /**
   * Convert to a hex string.
   */
  toString: function () {
    this.fullReduce();
    var out = "",
      i,
      s,
      l = this.limbs;
    for (i = 0; i < this.limbs.length; i++) {
      s = l[i].toString(16);
      while (i < this.limbs.length - 1 && s.length < 6) {
        s = "0" + s;
      }
      out = s + out;
    }
    return "0x" + out;
  },

  /** this += that.  Does not normalize. */
  addM: function (that) {
    if (typeof that !== "object") {
      that = new this._class(that);
    }
    var i,
      l = this.limbs,
      ll = that.limbs;
    for (i = l.length; i < ll.length; i++) {
      l[i] = 0;
    }
    for (i = 0; i < ll.length; i++) {
      l[i] += ll[i];
    }
    return this;
  },

  /** this *= 2.  Requires normalized; ends up normalized. */
  doubleM: function () {
    var i,
      carry = 0,
      tmp,
      r = this.radix,
      m = this.radixMask,
      l = this.limbs;
    for (i = 0; i < l.length; i++) {
      tmp = l[i];
      tmp = tmp + tmp + carry;
      l[i] = tmp & m;
      carry = tmp >> r;
    }
    if (carry) {
      l.push(carry);
    }
    return this;
  },

  /** this /= 2, rounded down.  Requires normalized; ends up normalized. */
  halveM: function () {
    var i,
      carry = 0,
      tmp,
      r = this.radix,
      l = this.limbs;
    for (i = l.length - 1; i >= 0; i--) {
      tmp = l[i];
      l[i] = (tmp + carry) >> 1;
      carry = (tmp & 1) << r;
    }
    if (!l[l.length - 1]) {
      l.pop();
    }
    return this;
  },

  /** this -= that.  Does not normalize. */
  subM: function (that) {
    if (typeof that !== "object") {
      that = new this._class(that);
    }
    var i,
      l = this.limbs,
      ll = that.limbs;
    for (i = l.length; i < ll.length; i++) {
      l[i] = 0;
    }
    for (i = 0; i < ll.length; i++) {
      l[i] -= ll[i];
    }
    return this;
  },

  mod: function (that) {
    var neg = !this.greaterEquals(new sjcl.bn(0));

    that = new sjcl.bn(that).normalize(); // copy before we begin
    var out = new sjcl.bn(this).normalize(),
      ci = 0;

    if (neg) out = new sjcl.bn(0).subM(out).normalize();

    for (; out.greaterEquals(that); ci++) {
      that.doubleM();
    }

    if (neg) out = that.sub(out).normalize();

    for (; ci > 0; ci--) {
      that.halveM();
      if (out.greaterEquals(that)) {
        out.subM(that).normalize();
      }
    }
    return out.trim();
  },

  /** return inverse mod prime p.  p must be odd. Binary extended Euclidean algorithm mod p. */
  inverseMod: function (p) {
    var a = new sjcl.bn(1),
      b = new sjcl.bn(0),
      x = new sjcl.bn(this),
      y = new sjcl.bn(p),
      tmp,
      i,
      nz = 1;

    if (!(p.limbs[0] & 1)) {
      throw new sjcl.exception.invalid("inverseMod: p must be odd");
    }

    // invariant: y is odd
    do {
      if (x.limbs[0] & 1) {
        if (!x.greaterEquals(y)) {
          // x < y; swap everything
          tmp = x;
          x = y;
          y = tmp;
          tmp = a;
          a = b;
          b = tmp;
        }
        x.subM(y);
        x.normalize();

        if (!a.greaterEquals(b)) {
          a.addM(p);
        }
        a.subM(b);
      }

      // cut everything in half
      x.halveM();
      if (a.limbs[0] & 1) {
        a.addM(p);
      }
      a.normalize();
      a.halveM();

      // check for termination: x ?= 0
      for (i = nz = 0; i < x.limbs.length; i++) {
        nz |= x.limbs[i];
      }
    } while (nz);

    if (!y.equals(1)) {
      throw new sjcl.exception.invalid(
        "inverseMod: p and x must be relatively prime"
      );
    }

    return b;
  },

  /** this + that.  Does not normalize. */
  add: function (that) {
    return this.copy().addM(that);
  },

  /** this - that.  Does not normalize. */
  sub: function (that) {
    return this.copy().subM(that);
  },

  /** this * that.  Normalizes and reduces. */
  mul: function (that) {
    if (typeof that === "number") {
      that = new this._class(that);
    } else {
      that.normalize();
    }
    this.normalize();
    var i,
      j,
      a = this.limbs,
      b = that.limbs,
      al = a.length,
      bl = b.length,
      out = new this._class(),
      c = out.limbs,
      ai,
      ii = this.maxMul;

    for (i = 0; i < this.limbs.length + that.limbs.length + 1; i++) {
      c[i] = 0;
    }
    for (i = 0; i < al; i++) {
      ai = a[i];
      for (j = 0; j < bl; j++) {
        c[i + j] += ai * b[j];
      }

      if (!--ii) {
        ii = this.maxMul;
        out.cnormalize();
      }
    }
    return out.cnormalize().reduce();
  },

  /** this ^ 2.  Normalizes and reduces. */
  square: function () {
    return this.mul(this);
  },

  /** this ^ n.  Uses square-and-multiply.  Normalizes and reduces. */
  power: function (l) {
    l = new sjcl.bn(l).normalize().trim().limbs;
    var i,
      j,
      out = new this._class(1),
      pow = this;

    for (i = 0; i < l.length; i++) {
      for (j = 0; j < this.radix; j++) {
        if (l[i] & (1 << j)) {
          out = out.mul(pow);
        }
        if (i == l.length - 1 && l[i] >> (j + 1) == 0) {
          break;
        }

        pow = pow.square();
      }
    }

    return out;
  },

  /** this * that mod N */
  mulmod: function (that, N) {
    return this.mod(N).mul(that.mod(N)).mod(N);
  },

  /** this ^ x mod N */
  powermod: function (x, N) {
    x = new sjcl.bn(x);
    N = new sjcl.bn(N);

    // Jump to montpowermod if possible.
    if ((N.limbs[0] & 1) == 1) {
      var montOut = this.montpowermod(x, N);

      if (montOut != false) {
        return montOut;
      } // else go to slow powermod
    }

    var i,
      j,
      l = x.normalize().trim().limbs,
      out = new this._class(1),
      pow = this;

    for (i = 0; i < l.length; i++) {
      for (j = 0; j < this.radix; j++) {
        if (l[i] & (1 << j)) {
          out = out.mulmod(pow, N);
        }
        if (i == l.length - 1 && l[i] >> (j + 1) == 0) {
          break;
        }

        pow = pow.mulmod(pow, N);
      }
    }

    return out;
  },

  /** this ^ x mod N with Montomery reduction */
  montpowermod: function (x, N) {
    x = new sjcl.bn(x).normalize().trim();
    N = new sjcl.bn(N);

    var i,
      j,
      radix = this.radix,
      out = new this._class(1),
      pow = this.copy();

    // Generate R as a cap of N.
    var R,
      s,
      wind,
      bitsize = x.bitLength();

    R = new sjcl.bn({
      limbs: N.copy()
        .normalize()
        .trim()
        .limbs.map(function () {
          return 0;
        }),
    });

    for (s = this.radix; s > 0; s--) {
      if (((N.limbs[N.limbs.length - 1] >> s) & 1) == 1) {
        R.limbs[R.limbs.length - 1] = 1 << s;
        break;
      }
    }

    // Calculate window size as a function of the exponent's size.
    if (bitsize == 0) {
      return this;
    } else if (bitsize < 18) {
      wind = 1;
    } else if (bitsize < 48) {
      wind = 3;
    } else if (bitsize < 144) {
      wind = 4;
    } else if (bitsize < 768) {
      wind = 5;
    } else {
      wind = 6;
    }

    // Find R' and N' such that R * R' - N * N' = 1.
    var RR = R.copy(),
      NN = N.copy(),
      RP = new sjcl.bn(1),
      NP = new sjcl.bn(0),
      RT = R.copy();

    while (RT.greaterEquals(1)) {
      RT.halveM();

      if ((RP.limbs[0] & 1) == 0) {
        RP.halveM();
        NP.halveM();
      } else {
        RP.addM(NN);
        RP.halveM();

        NP.halveM();
        NP.addM(RR);
      }
    }

    RP = RP.normalize();
    NP = NP.normalize();

    RR.doubleM();
    var R2 = RR.mulmod(RR, N);

    // Check whether the invariant holds.
    // If it doesn't, we can't use Montgomery reduction on this modulus.
    if (!RR.mul(RP).sub(N.mul(NP)).equals(1)) {
      return false;
    }

    var montIn = function (c) {
        return montMul(c, R2);
      },
      montMul = function (a, b) {
        // Standard Montgomery reduction
        var k,
          ab,
          right,
          abBar,
          mask = (1 << (s + 1)) - 1;

        ab = a.mul(b);

        right = ab.mul(NP);
        right.limbs = right.limbs.slice(0, R.limbs.length);

        if (right.limbs.length == R.limbs.length) {
          right.limbs[R.limbs.length - 1] &= mask;
        }

        right = right.mul(N);

        abBar = ab.add(right).normalize().trim();
        abBar.limbs = abBar.limbs.slice(R.limbs.length - 1);

        // Division.  Equivelent to calling *.halveM() s times.
        for (k = 0; k < abBar.limbs.length; k++) {
          if (k > 0) {
            abBar.limbs[k - 1] |= (abBar.limbs[k] & mask) << (radix - s - 1);
          }

          abBar.limbs[k] = abBar.limbs[k] >> (s + 1);
        }

        if (abBar.greaterEquals(N)) {
          abBar.subM(N);
        }

        return abBar;
      },
      montOut = function (c) {
        return montMul(c, 1);
      };

    pow = montIn(pow);
    out = montIn(out);

    // Sliding-Window Exponentiation (HAC 14.85)
    var h,
      precomp = {},
      cap = (1 << (wind - 1)) - 1;

    precomp[1] = pow.copy();
    precomp[2] = montMul(pow, pow);

    for (h = 1; h <= cap; h++) {
      precomp[2 * h + 1] = montMul(precomp[2 * h - 1], precomp[2]);
    }

    var getBit = function (exp, i) {
      // Gets ith bit of exp.
      var off = i % exp.radix;

      return (exp.limbs[Math.floor(i / exp.radix)] & (1 << off)) >> off;
    };

    for (i = x.bitLength() - 1; i >= 0; ) {
      if (getBit(x, i) == 0) {
        // If the next bit is zero:
        //   Square, move forward one bit.
        out = montMul(out, out);
        i = i - 1;
      } else {
        // If the next bit is one:
        //   Find the longest sequence of bits after this one, less than `wind`
        //   bits long, that ends with a 1.  Convert the sequence into an
        //   integer and look up the pre-computed value to add.
        var l = i - wind + 1;

        while (getBit(x, l) == 0) {
          l++;
        }

        var indx = 0;
        for (j = l; j <= i; j++) {
          indx += getBit(x, j) << (j - l);
          out = montMul(out, out);
        }

        out = montMul(out, precomp[indx]);

        i = l - 1;
      }
    }

    return montOut(out);
  },

  trim: function () {
    var l = this.limbs,
      p;
    do {
      p = l.pop();
    } while (l.length && p === 0);
    l.push(p);
    return this;
  },

  /** Reduce mod a modulus.  Stubbed for subclassing. */
  reduce: function () {
    return this;
  },

  /** Reduce and normalize. */
  fullReduce: function () {
    return this.normalize();
  },

  /** Propagate carries. */
  normalize: function () {
    var carry = 0,
      i,
      pv = this.placeVal,
      ipv = this.ipv,
      l,
      m,
      limbs = this.limbs,
      ll = limbs.length,
      mask = this.radixMask;
    for (i = 0; i < ll || (carry !== 0 && carry !== -1); i++) {
      l = (limbs[i] || 0) + carry;
      m = limbs[i] = l & mask;
      carry = (l - m) * ipv;
    }
    if (carry === -1) {
      limbs[i - 1] -= pv;
    }
    this.trim();
    return this;
  },

  /** Constant-time normalize. Does not allocate additional space. */
  cnormalize: function () {
    var carry = 0,
      i,
      ipv = this.ipv,
      l,
      m,
      limbs = this.limbs,
      ll = limbs.length,
      mask = this.radixMask;
    for (i = 0; i < ll - 1; i++) {
      l = limbs[i] + carry;
      m = limbs[i] = l & mask;
      carry = (l - m) * ipv;
    }
    limbs[i] += carry;
    return this;
  },

  /** Serialize to a bit array */
  toBits: function (len) {
    this.fullReduce();
    len = len || this.exponent || this.bitLength();
    var i = Math.floor((len - 1) / 24),
      w = sjcl.bitArray,
      e = ((len + 7) & -8) % this.radix || this.radix,
      out = [w.partial(e, this.getLimb(i))];
    for (i--; i >= 0; i--) {
      out = w.concat(out, [
        w.partial(Math.min(this.radix, len), this.getLimb(i)),
      ]);
      len -= this.radix;
    }
    return out;
  },

  /** Return the length in bits, rounded up to the nearest byte. */
  bitLength: function () {
    this.fullReduce();
    var out = this.radix * (this.limbs.length - 1),
      b = this.limbs[this.limbs.length - 1];
    for (; b; b >>>= 1) {
      out++;
    }
    return (out + 7) & -8;
  },
};

/** @memberOf sjcl.bn
 * @this { sjcl.bn }
 */
sjcl.bn.fromBits = function (bits) {
  var Class = this,
    out = new Class(),
    words = [],
    w = sjcl.bitArray,
    t = this.prototype,
    l = Math.min(this.bitLength || 0x100000000, w.bitLength(bits)),
    e = l % t.radix || t.radix;

  words[0] = w.extract(bits, 0, e);
  for (; e < l; e += t.radix) {
    words.unshift(w.extract(bits, e, t.radix));
  }

  out.limbs = words;
  return out;
};

sjcl.bn.prototype.ipv =
  1 / (sjcl.bn.prototype.placeVal = Math.pow(2, sjcl.bn.prototype.radix));
sjcl.bn.prototype.radixMask = (1 << sjcl.bn.prototype.radix) - 1;

/**
 * Creates a new subclass of bn, based on reduction modulo a pseudo-Mersenne prime,
 * i.e. a prime of the form 2^e + sum(a * 2^b),where the sum is negative and sparse.
 */
sjcl.bn.pseudoMersennePrime = function (exponent, coeff) {
  /** @constructor
   * @private
   */
  function p(it) {
    this.initWith(it);
    /*if (this.limbs[this.modOffset]) {
      this.reduce();
    }*/
  }

  var ppr = (p.prototype = new sjcl.bn()),
    i,
    tmp,
    mo;
  mo = ppr.modOffset = Math.ceil((tmp = exponent / ppr.radix));
  ppr.exponent = exponent;
  ppr.offset = [];
  ppr.factor = [];
  ppr.minOffset = mo;
  ppr.fullMask = 0;
  ppr.fullOffset = [];
  ppr.fullFactor = [];
  ppr.modulus = p.modulus = new sjcl.bn(Math.pow(2, exponent));

  ppr.fullMask = 0 | -Math.pow(2, exponent % ppr.radix);

  for (i = 0; i < coeff.length; i++) {
    ppr.offset[i] = Math.floor(coeff[i][0] / ppr.radix - tmp);
    ppr.fullOffset[i] = Math.floor(coeff[i][0] / ppr.radix) - mo + 1;
    ppr.factor[i] =
      coeff[i][1] *
      Math.pow(1 / 2, exponent - coeff[i][0] + ppr.offset[i] * ppr.radix);
    ppr.fullFactor[i] =
      coeff[i][1] *
      Math.pow(1 / 2, exponent - coeff[i][0] + ppr.fullOffset[i] * ppr.radix);
    ppr.modulus.addM(new sjcl.bn(Math.pow(2, coeff[i][0]) * coeff[i][1]));
    ppr.minOffset = Math.min(ppr.minOffset, -ppr.offset[i]); // conservative
  }
  ppr._class = p;
  ppr.modulus.cnormalize();

  /** Approximate reduction mod p.  May leave a number which is negative or slightly larger than p.
   * @memberof sjcl.bn
   * @this { sjcl.bn }
   */
  ppr.reduce = function () {
    var i,
      k,
      l,
      mo = this.modOffset,
      limbs = this.limbs,
      off = this.offset,
      ol = this.offset.length,
      fac = this.factor,
      ll;

    i = this.minOffset;
    while (limbs.length > mo) {
      l = limbs.pop();
      ll = limbs.length;
      for (k = 0; k < ol; k++) {
        limbs[ll + off[k]] -= fac[k] * l;
      }

      i--;
      if (!i) {
        limbs.push(0);
        this.cnormalize();
        i = this.minOffset;
      }
    }
    this.cnormalize();

    return this;
  };

  /** @memberof sjcl.bn
   * @this { sjcl.bn }
   */
  ppr._strongReduce =
    ppr.fullMask === -1
      ? ppr.reduce
      : function () {
          var limbs = this.limbs,
            i = limbs.length - 1,
            k,
            l;
          this.reduce();
          if (i === this.modOffset - 1) {
            l = limbs[i] & this.fullMask;
            limbs[i] -= l;
            for (k = 0; k < this.fullOffset.length; k++) {
              limbs[i + this.fullOffset[k]] -= this.fullFactor[k] * l;
            }
            this.normalize();
          }
        };

  /** mostly constant-time, very expensive full reduction.
   * @memberof sjcl.bn
   * @this { sjcl.bn }
   */
  ppr.fullReduce = function () {
    var greater, i;
    // massively above the modulus, may be negative

    this._strongReduce();
    // less than twice the modulus, may be negative

    this.addM(this.modulus);
    this.addM(this.modulus);
    this.normalize();
    // probably 2-3x the modulus

    this._strongReduce();
    // less than the power of 2.  still may be more than
    // the modulus

    // HACK: pad out to this length
    for (i = this.limbs.length; i < this.modOffset; i++) {
      this.limbs[i] = 0;
    }

    // constant-time subtract modulus
    greater = this.greaterEquals(this.modulus);
    for (i = 0; i < this.limbs.length; i++) {
      this.limbs[i] -= this.modulus.limbs[i] * greater;
    }
    this.cnormalize();

    return this;
  };

  /** @memberof sjcl.bn
   * @this { sjcl.bn }
   */
  ppr.inverse = function () {
    return this.power(this.modulus.sub(2));
  };

  p.fromBits = sjcl.bn.fromBits;

  return p;
};

// a small Mersenne prime
var sbp = sjcl.bn.pseudoMersennePrime;
sjcl.bn.prime = {
  p127: sbp(127, [[0, -1]]),

  // Bernstein's prime for Curve25519
  p25519: sbp(255, [[0, -19]]),

  // Koblitz primes
  p192k: sbp(192, [
    [32, -1],
    [12, -1],
    [8, -1],
    [7, -1],
    [6, -1],
    [3, -1],
    [0, -1],
  ]),
  p224k: sbp(224, [
    [32, -1],
    [12, -1],
    [11, -1],
    [9, -1],
    [7, -1],
    [4, -1],
    [1, -1],
    [0, -1],
  ]),
  p256k: sbp(256, [
    [32, -1],
    [9, -1],
    [8, -1],
    [7, -1],
    [6, -1],
    [4, -1],
    [0, -1],
  ]),

  // NIST primes
  p192: sbp(192, [
    [0, -1],
    [64, -1],
  ]),
  p224: sbp(224, [
    [0, 1],
    [96, -1],
  ]),
  p256: sbp(256, [
    [0, -1],
    [96, 1],
    [192, 1],
    [224, -1],
  ]),
  p384: sbp(384, [
    [0, -1],
    [32, 1],
    [96, -1],
    [128, -1],
  ]),
  p521: sbp(521, [[0, -1]]),
};

sjcl.bn.random = function (modulus, paranoia) {
  if (typeof modulus !== "object") {
    modulus = new sjcl.bn(modulus);
  }
  var words,
    i,
    l = modulus.limbs.length,
    m = modulus.limbs[l - 1] + 1,
    out = new sjcl.bn();
  while (true) {
    // get a sequence whose first digits make sense
    do {
      words = sjcl.random.randomWords(l, paranoia);
      if (words[l - 1] < 0) {
        words[l - 1] += 0x100000000;
      }
    } while (Math.floor(words[l - 1] / m) === Math.floor(0x100000000 / m));
    words[l - 1] %= m;

    // mask off all the limbs
    for (i = 0; i < l - 1; i++) {
      words[i] &= modulus.radixMask;
    }

    // check the rest of the digitssj
    out.limbs = words;
    if (!out.greaterEquals(modulus)) {
      return out;
    }
  }
};

sjcl.ecc = {};

/**
 * Represents a point on a curve in affine coordinates.
 * @constructor
 * @param {sjcl.ecc.curve} curve The curve that this point lies on.
 * @param {bigInt} x The x coordinate.
 * @param {bigInt} y The y coordinate.
 */
sjcl.ecc.point = function (curve, x, y) {
  if (x === undefined) {
    this.isIdentity = true;
  } else {
    if (x instanceof sjcl.bn) {
      x = new curve.field(x);
    }
    if (y instanceof sjcl.bn) {
      y = new curve.field(y);
    }

    this.x = x;
    this.y = y;

    this.isIdentity = false;
  }
  this.curve = curve;
};

sjcl.ecc.point.prototype = {
  toJac: function () {
    return new sjcl.ecc.pointJac(
      this.curve,
      this.x,
      this.y,
      new this.curve.field(1)
    );
  },

  mult: function (k) {
    return this.toJac().mult(k, this).toAffine();
  },

  /**
   * Multiply this point by k, added to affine2*k2, and return the answer in Jacobian coordinates.
   * @param {bigInt} k The coefficient to multiply this by.
   * @param {bigInt} k2 The coefficient to multiply affine2 this by.
   * @param {sjcl.ecc.point} affine The other point in affine coordinates.
   * @return {sjcl.ecc.pointJac} The result of the multiplication and addition, in Jacobian coordinates.
   */
  mult2: function (k, k2, affine2) {
    return this.toJac().mult2(k, this, k2, affine2).toAffine();
  },

  multiples: function () {
    var m, i, j;
    if (this._multiples === undefined) {
      j = this.toJac().doubl();
      m = this._multiples = [
        new sjcl.ecc.point(this.curve),
        this,
        j.toAffine(),
      ];
      for (i = 3; i < 16; i++) {
        j = j.add(this);
        m.push(j.toAffine());
      }
    }
    return this._multiples;
  },

  negate: function () {
    var newY = new this.curve.field(0).sub(this.y).normalize().reduce();
    return new sjcl.ecc.point(this.curve, this.x, newY);
  },

  isValid: function () {
    return this.y
      .square()
      .equals(this.curve.b.add(this.x.mul(this.curve.a.add(this.x.square()))));
  },

  toBits: function () {
    return sjcl.bitArray.concat(this.x.toBits(), this.y.toBits());
  },
};

/**
 * Represents a point on a curve in Jacobian coordinates. Coordinates can be specified as bigInts or strings (which
 * will be converted to bigInts).
 *
 * @constructor
 * @param {bigInt/string} x The x coordinate.
 * @param {bigInt/string} y The y coordinate.
 * @param {bigInt/string} z The z coordinate.
 * @param {sjcl.ecc.curve} curve The curve that this point lies on.
 */
sjcl.ecc.pointJac = function (curve, x, y, z) {
  if (x === undefined) {
    this.isIdentity = true;
  } else {
    this.x = x;
    this.y = y;
    this.z = z;
    this.isIdentity = false;
  }
  this.curve = curve;
};

sjcl.ecc.pointJac.prototype = {
  /**
   * Adds S and T and returns the result in Jacobian coordinates. Note that S must be in Jacobian coordinates and T must be in affine coordinates.
   * @param {sjcl.ecc.pointJac} S One of the points to add, in Jacobian coordinates.
   * @param {sjcl.ecc.point} T The other point to add, in affine coordinates.
   * @return {sjcl.ecc.pointJac} The sum of the two points, in Jacobian coordinates.
   */
  add: function (T) {
    var S = this,
      sz2,
      c,
      d,
      c2,
      x1,
      x2,
      x,
      y1,
      y2,
      y,
      z;
    if (S.curve !== T.curve) {
      throw new sjcl.exception.invalid(
        "sjcl.ecc.add(): Points must be on the same curve to add them!"
      );
    }

    if (S.isIdentity) {
      return T.toJac();
    } else if (T.isIdentity) {
      return S;
    }

    sz2 = S.z.square();
    c = T.x.mul(sz2).subM(S.x);

    if (c.equals(0)) {
      if (S.y.equals(T.y.mul(sz2.mul(S.z)))) {
        // same point
        return S.doubl();
      } else {
        // inverses
        return new sjcl.ecc.pointJac(S.curve);
      }
    }

    d = T.y.mul(sz2.mul(S.z)).subM(S.y);
    c2 = c.square();

    x1 = d.square();
    x2 = c.square().mul(c).addM(S.x.add(S.x).mul(c2));
    x = x1.subM(x2);

    y1 = S.x.mul(c2).subM(x).mul(d);
    y2 = S.y.mul(c.square().mul(c));
    y = y1.subM(y2);

    z = S.z.mul(c);

    return new sjcl.ecc.pointJac(this.curve, x, y, z);
  },

  /**
   * doubles this point.
   * @return {sjcl.ecc.pointJac} The doubled point.
   */
  doubl: function () {
    if (this.isIdentity) {
      return this;
    }

    var y2 = this.y.square(),
      a = y2.mul(this.x.mul(4)),
      b = y2.square().mul(8),
      z2 = this.z.square(),
      c =
        this.curve.a.toString() == new sjcl.bn(-3).toString()
          ? this.x.sub(z2).mul(3).mul(this.x.add(z2))
          : this.x.square().mul(3).add(z2.square().mul(this.curve.a)),
      x = c.square().subM(a).subM(a),
      y = a.sub(x).mul(c).subM(b),
      z = this.y.add(this.y).mul(this.z);
    return new sjcl.ecc.pointJac(this.curve, x, y, z);
  },

  /**
   * Returns a copy of this point converted to affine coordinates.
   * @return {sjcl.ecc.point} The converted point.
   */
  toAffine: function () {
    if (this.isIdentity || this.z.equals(0)) {
      return new sjcl.ecc.point(this.curve);
    }
    var zi = this.z.inverse(),
      zi2 = zi.square();
    return new sjcl.ecc.point(
      this.curve,
      this.x.mul(zi2).fullReduce(),
      this.y.mul(zi2.mul(zi)).fullReduce()
    );
  },

  /**
   * Multiply this point by k and return the answer in Jacobian coordinates.
   * @param {bigInt} k The coefficient to multiply by.
   * @param {sjcl.ecc.point} affine This point in affine coordinates.
   * @return {sjcl.ecc.pointJac} The result of the multiplication, in Jacobian coordinates.
   */
  mult: function (k, affine) {
    if (typeof k === "number") {
      k = [k];
    } else if (k.limbs !== undefined) {
      k = k.normalize().limbs;
    }

    var i,
      j,
      out = new sjcl.ecc.point(this.curve).toJac(),
      multiples = affine.multiples();

    for (i = k.length - 1; i >= 0; i--) {
      for (j = sjcl.bn.prototype.radix - 4; j >= 0; j -= 4) {
        out = out
          .doubl()
          .doubl()
          .doubl()
          .doubl()
          .add(multiples[(k[i] >> j) & 0xf]);
      }
    }

    return out;
  },

  /**
   * Multiply this point by k, added to affine2*k2, and return the answer in Jacobian coordinates.
   * @param {bigInt} k The coefficient to multiply this by.
   * @param {sjcl.ecc.point} affine This point in affine coordinates.
   * @param {bigInt} k2 The coefficient to multiply affine2 this by.
   * @param {sjcl.ecc.point} affine The other point in affine coordinates.
   * @return {sjcl.ecc.pointJac} The result of the multiplication and addition, in Jacobian coordinates.
   */
  mult2: function (k1, affine, k2, affine2) {
    if (typeof k1 === "number") {
      k1 = [k1];
    } else if (k1.limbs !== undefined) {
      k1 = k1.normalize().limbs;
    }

    if (typeof k2 === "number") {
      k2 = [k2];
    } else if (k2.limbs !== undefined) {
      k2 = k2.normalize().limbs;
    }

    var i,
      j,
      out = new sjcl.ecc.point(this.curve).toJac(),
      m1 = affine.multiples(),
      m2 = affine2.multiples(),
      l1,
      l2;

    for (i = Math.max(k1.length, k2.length) - 1; i >= 0; i--) {
      l1 = k1[i] | 0;
      l2 = k2[i] | 0;
      for (j = sjcl.bn.prototype.radix - 4; j >= 0; j -= 4) {
        out = out
          .doubl()
          .doubl()
          .doubl()
          .doubl()
          .add(m1[(l1 >> j) & 0xf])
          .add(m2[(l2 >> j) & 0xf]);
      }
    }

    return out;
  },

  negate: function () {
    return this.toAffine().negate().toJac();
  },

  isValid: function () {
    var z2 = this.z.square(),
      z4 = z2.square(),
      z6 = z4.mul(z2);
    return this.y
      .square()
      .equals(
        this.curve.b
          .mul(z6)
          .add(this.x.mul(this.curve.a.mul(z4).add(this.x.square())))
      );
  },
};

/**
 * Construct an elliptic curve. Most users will not use this and instead start with one of the NIST curves defined below.
 *
 * @constructor
 * @param {bigInt} p The prime modulus.
 * @param {bigInt} r The prime order of the curve.
 * @param {bigInt} a The constant a in the equation of the curve y^2 = x^3 + ax + b (for NIST curves, a is always -3).
 * @param {bigInt} x The x coordinate of a base point of the curve.
 * @param {bigInt} y The y coordinate of a base point of the curve.
 */
sjcl.ecc.curve = function (Field, r, a, b, x, y) {
  this.field = Field;
  this.r = new sjcl.bn(r);
  this.a = new Field(a);
  this.b = new Field(b);
  this.G = new sjcl.ecc.point(this, new Field(x), new Field(y));
};

sjcl.ecc.curve.prototype.fromBits = function (bits) {
  var w = sjcl.bitArray,
    l = (this.field.prototype.exponent + 7) & -8,
    p = new sjcl.ecc.point(
      this,
      this.field.fromBits(w.bitSlice(bits, 0, l)),
      this.field.fromBits(w.bitSlice(bits, l, 2 * l))
    );
  if (!p.isValid()) {
    throw new sjcl.exception.corrupt("not on the curve!");
  }
  return p;
};

sjcl.ecc.curves = {
  c192: new sjcl.ecc.curve(
    sjcl.bn.prime.p192,
    "0xffffffffffffffffffffffff99def836146bc9b1b4d22831",
    -3,
    "0x64210519e59c80e70fa7e9ab72243049feb8deecc146b9b1",
    "0x188da80eb03090f67cbf20eb43a18800f4ff0afd82ff1012",
    "0x07192b95ffc8da78631011ed6b24cdd573f977a11e794811"
  ),

  c224: new sjcl.ecc.curve(
    sjcl.bn.prime.p224,
    "0xffffffffffffffffffffffffffff16a2e0b8f03e13dd29455c5c2a3d",
    -3,
    "0xb4050a850c04b3abf54132565044b0b7d7bfd8ba270b39432355ffb4",
    "0xb70e0cbd6bb4bf7f321390b94a03c1d356c21122343280d6115c1d21",
    "0xbd376388b5f723fb4c22dfe6cd4375a05a07476444d5819985007e34"
  ),

  c256: new sjcl.ecc.curve(
    sjcl.bn.prime.p256,
    "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
    -3,
    "0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b",
    "0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296",
    "0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
  ),

  c384: new sjcl.ecc.curve(
    sjcl.bn.prime.p384,
    "0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973",
    -3,
    "0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef",
    "0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7",
    "0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f"
  ),

  c521: new sjcl.ecc.curve(
    sjcl.bn.prime.p521,
    "0x1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFA51868783BF2F966B7FCC0148F709A5D03BB5C9B8899C47AEBB6FB71E91386409",
    -3,
    "0x051953EB9618E1C9A1F929A21A0B68540EEA2DA725B99B315F3B8B489918EF109E156193951EC7E937B1652C0BD3BB1BF073573DF883D2C34F1EF451FD46B503F00",
    "0xC6858E06B70404E9CD9E3ECB662395B4429C648139053FB521F828AF606B4D3DBAA14B5E77EFE75928FE1DC127A2FFA8DE3348B3C1856A429BF97E7E31C2E5BD66",
    "0x11839296A789A3BC0045C8A5FB42C7D1BD998F54449579B446817AFBD17273E662C97EE72995EF42640C550B9013FAD0761353C7086A272C24088BE94769FD16650"
  ),

  k192: new sjcl.ecc.curve(
    sjcl.bn.prime.p192k,
    "0xfffffffffffffffffffffffe26f2fc170f69466a74defd8d",
    0,
    3,
    "0xdb4ff10ec057e9ae26b07d0280b7f4341da5d1b1eae06c7d",
    "0x9b2f2f6d9c5628a7844163d015be86344082aa88d95e2f9d"
  ),

  k224: new sjcl.ecc.curve(
    sjcl.bn.prime.p224k,
    "0x010000000000000000000000000001dce8d2ec6184caf0a971769fb1f7",
    0,
    5,
    "0xa1455b334df099df30fc28a169a467e9e47075a90f7e650eb6b7a45c",
    "0x7e089fed7fba344282cafbd6f7e319f7c0b0bd59e2ca4bdb556d61a5"
  ),

  k256: new sjcl.ecc.curve(
    sjcl.bn.prime.p256k,
    "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
    0,
    7,
    "0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    "0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8"
  ),
};

sjcl.ecc.curveName = function (curve) {
  var curcurve;
  for (curcurve in sjcl.ecc.curves) {
    if (sjcl.ecc.curves.hasOwnProperty(curcurve)) {
      if (sjcl.ecc.curves[curcurve] === curve) {
        return curcurve;
      }
    }
  }

  throw new sjcl.exception.invalid("no such curve");
};

sjcl.ecc.deserialize = function (key) {
  var types = ["elGamal", "ecdsa"];

  if (!key || !key.curve || !sjcl.ecc.curves[key.curve]) {
    throw new sjcl.exception.invalid("invalid serialization");
  }
  if (types.indexOf(key.type) === -1) {
    throw new sjcl.exception.invalid("invalid type");
  }

  var curve = sjcl.ecc.curves[key.curve];

  if (key.secretKey) {
    if (!key.exponent) {
      throw new sjcl.exception.invalid("invalid exponent");
    }
    var exponent = new sjcl.bn(key.exponent);
    return new sjcl.ecc[key.type].secretKey(curve, exponent);
  } else {
    if (!key.point) {
      throw new sjcl.exception.invalid("invalid point");
    }

    var point = curve.fromBits(sjcl.codec.hex.toBits(key.point));
    return new sjcl.ecc[key.type].publicKey(curve, point);
  }
};

/** our basicKey classes
 */
sjcl.ecc.basicKey = {
  /** ecc publicKey.
   * @constructor
   * @param {curve} curve the elliptic curve
   * @param {point} point the point on the curve
   */
  publicKey: function (curve, point) {
    this._curve = curve;
    this._curveBitLength = curve.r.bitLength();
    if (point instanceof Array) {
      this._point = curve.fromBits(point);
    } else {
      this._point = point;
    }

    this.serialize = function () {
      var curveName = sjcl.ecc.curveName(curve);
      return {
        type: this.getType(),
        secretKey: false,
        point: sjcl.codec.hex.fromBits(this._point.toBits()),
        curve: curveName,
      };
    };

    /** get this keys point data
     * @return x and y as bitArrays
     */
    this.get = function () {
      var pointbits = this._point.toBits();
      var len = sjcl.bitArray.bitLength(pointbits);
      var x = sjcl.bitArray.bitSlice(pointbits, 0, len / 2);
      var y = sjcl.bitArray.bitSlice(pointbits, len / 2);
      return { x: x, y: y };
    };
  },

  /** ecc secretKey
   * @constructor
   * @param {curve} curve the elliptic curve
   * @param exponent
   */
  secretKey: function (curve, exponent) {
    this._curve = curve;
    this._curveBitLength = curve.r.bitLength();
    this._exponent = exponent;

    this.serialize = function () {
      var exponent = this.get();
      var curveName = sjcl.ecc.curveName(curve);
      return {
        type: this.getType(),
        secretKey: true,
        exponent: sjcl.codec.hex.fromBits(exponent),
        curve: curveName,
      };
    };

    /** get this keys exponent data
     * @return {bitArray} exponent
     */
    this.get = function () {
      return this._exponent.toBits();
    };
  },
};

/** @private */
sjcl.ecc.basicKey.generateKeys = function (cn) {
  return function generateKeys(curve, paranoia, sec) {
    curve = curve || 256;

    if (typeof curve === "number") {
      curve = sjcl.ecc.curves["c" + curve];
      if (curve === undefined) {
        throw new sjcl.exception.invalid("no such curve");
      }
    }
    sec = sec || sjcl.bn.random(curve.r, paranoia);

    var pub = curve.G.mult(sec);
    return {
      pub: new sjcl.ecc[cn].publicKey(curve, pub),
      sec: new sjcl.ecc[cn].secretKey(curve, sec),
    };
  };
};

/** elGamal keys */
sjcl.ecc.elGamal = {
  /** generate keys
   * @function
   * @param curve
   * @param {int} paranoia Paranoia for generation (default 6)
   * @param {secretKey} sec secret Key to use. used to get the publicKey for ones secretKey
   */
  generateKeys: sjcl.ecc.basicKey.generateKeys("elGamal"),
  /** elGamal publicKey.
   * @constructor
   * @augments sjcl.ecc.basicKey.publicKey
   */
  publicKey: function (curve, point) {
    sjcl.ecc.basicKey.publicKey.apply(this, arguments);
  },
  /** elGamal secretKey
   * @constructor
   * @augments sjcl.ecc.basicKey.secretKey
   */
  secretKey: function (curve, exponent) {
    sjcl.ecc.basicKey.secretKey.apply(this, arguments);
  },
};

sjcl.ecc.elGamal.publicKey.prototype = {
  /** Kem function of elGamal Public Key
   * @param paranoia paranoia to use for randomization.
   * @return {object} key and tag. unkem(tag) with the corresponding secret key results in the key returned.
   */
  kem: function (paranoia) {
    var sec = sjcl.bn.random(this._curve.r, paranoia),
      tag = this._curve.G.mult(sec).toBits(),
      key = sjcl.hash.sha256.hash(this._point.mult(sec).toBits());
    return { key: key, tag: tag };
  },

  getType: function () {
    return "elGamal";
  },
};

sjcl.ecc.elGamal.secretKey.prototype = {
  /** UnKem function of elGamal Secret Key
   * @param {bitArray} tag The Tag to decrypt.
   * @return {bitArray} decrypted key.
   */
  unkem: function (tag) {
    return sjcl.hash.sha256.hash(
      this._curve.fromBits(tag).mult(this._exponent).toBits()
    );
  },

  /** Diffie-Hellmann function
   * @param {elGamal.publicKey} pk The Public Key to do Diffie-Hellmann with
   * @return {bitArray} diffie-hellmann result for this key combination.
   */
  dh: function (pk) {
    return sjcl.hash.sha256.hash(pk._point.mult(this._exponent).toBits());
  },

  /** Diffie-Hellmann function, compatible with Java generateSecret
   * @param {elGamal.publicKey} pk The Public Key to do Diffie-Hellmann with
   * @return {bitArray} undigested X value, diffie-hellmann result for this key combination,
   * compatible with Java generateSecret().
   */
  dhJavaEc: function (pk) {
    return pk._point.mult(this._exponent).x.toBits();
  },

  getType: function () {
    return "elGamal";
  },
};

/** ecdsa keys */
sjcl.ecc.ecdsa = {
  /** generate keys
   * @function
   * @param curve
   * @param {int} paranoia Paranoia for generation (default 6)
   * @param {secretKey} sec secret Key to use. used to get the publicKey for ones secretKey
   */
  generateKeys: sjcl.ecc.basicKey.generateKeys("ecdsa"),
};

/** ecdsa publicKey.
 * @constructor
 * @augments sjcl.ecc.basicKey.publicKey
 */
sjcl.ecc.ecdsa.publicKey = function (curve, point) {
  sjcl.ecc.basicKey.publicKey.apply(this, arguments);
};

/** specific functions for ecdsa publicKey. */
sjcl.ecc.ecdsa.publicKey.prototype = {
  /** Diffie-Hellmann function
   * @param {bitArray} hash hash to verify.
   * @param {bitArray} rs signature bitArray.
   * @param {boolean}  fakeLegacyVersion use old legacy version
   */
  verify: function (hash, rs, fakeLegacyVersion) {
    if (sjcl.bitArray.bitLength(hash) > this._curveBitLength) {
      hash = sjcl.bitArray.clamp(hash, this._curveBitLength);
    }
    var w = sjcl.bitArray,
      R = this._curve.r,
      l = this._curveBitLength,
      r = sjcl.bn.fromBits(w.bitSlice(rs, 0, l)),
      ss = sjcl.bn.fromBits(w.bitSlice(rs, l, 2 * l)),
      s = fakeLegacyVersion ? ss : ss.inverseMod(R),
      hG = sjcl.bn.fromBits(hash).mul(s).mod(R),
      hA = r.mul(s).mod(R),
      r2 = this._curve.G.mult2(hG, hA, this._point).x;
    if (
      r.equals(0) ||
      ss.equals(0) ||
      r.greaterEquals(R) ||
      ss.greaterEquals(R) ||
      !r2.equals(r)
    ) {
      if (fakeLegacyVersion === undefined) {
        return this.verify(hash, rs, true);
      } else {
        throw new sjcl.exception.corrupt("signature didn't check out");
      }
    }
    return true;
  },

  getType: function () {
    return "ecdsa";
  },
};

/** ecdsa secretKey
 * @constructor
 * @augments sjcl.ecc.basicKey.publicKey
 */
sjcl.ecc.ecdsa.secretKey = function (curve, exponent) {
  sjcl.ecc.basicKey.secretKey.apply(this, arguments);
};

/** specific functions for ecdsa secretKey. */
sjcl.ecc.ecdsa.secretKey.prototype = {
  /** Diffie-Hellmann function
   * @param {bitArray} hash hash to sign.
   * @param {int} paranoia paranoia for random number generation
   * @param {boolean} fakeLegacyVersion use old legacy version
   */
  sign: function (hash, paranoia, fakeLegacyVersion, fixedKForTesting) {
    if (sjcl.bitArray.bitLength(hash) > this._curveBitLength) {
      hash = sjcl.bitArray.clamp(hash, this._curveBitLength);
    }
    var R = this._curve.r,
      l = R.bitLength(),
      k = fixedKForTesting || sjcl.bn.random(R.sub(1), paranoia).add(1),
      r = this._curve.G.mult(k).x.mod(R),
      ss = sjcl.bn.fromBits(hash).add(r.mul(this._exponent)),
      s = fakeLegacyVersion
        ? ss.inverseMod(R).mul(k).mod(R)
        : ss.mul(k.inverseMod(R)).mod(R);
    return sjcl.bitArray.concat(r.toBits(l), s.toBits(l));
  },

  getType: function () {
    return "ecdsa";
  },
};

export default sjcl;
