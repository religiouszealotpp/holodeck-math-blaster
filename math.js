class MathGenerator {
  static generateProblem(rank, waveLevel = 1) {
    let question = '';
    let category = 'TACTICAL CALCULATION';
    let answer = 0;
    let distractors = [];
    let visData = null;

    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    switch(rank) {
      case 'ensign': {
        category = 'TIMES TABLES, DIVISION & EXPONENTS';
        if (waveLevel <= 2) {
          const a = randInt(3, 9);
          const b = randInt(2, 9);
          question = `${a} × ${b}`;
          answer = a * b;
          visData = {
            type: 'grid',
            a: a,
            b: b,
            title: 'ARRAY MULTIPLICATION MATRIX',
            formulaStr: `${a} × ${b} = ${answer}`,
            hint: `• <b>Multiplication Concept</b>: ${a} rows of ${b} items each.<br>• <b>Total Product</b>: ${a} × ${b} = <b>${answer}</b>.`
          };
        } else if (waveLevel <= 4) {
          const b = randInt(3, 9);
          answer = randInt(3, 9);
          const a = b * answer;
          question = `${a} ÷ ${b}`;
          visData = {
            type: 'division',
            total: a,
            divisor: b,
            answer: answer,
            title: 'EQUAL SHARING DIVISION',
            formulaStr: `${a} ÷ ${b} = ${answer}`,
            hint: `• <b>Division Concept</b>: Partition ${a} units into ${b} equal groups.<br>• <b>Each Group Contains</b>: <b>${answer}</b> units.`
          };
        } else if (waveLevel <= 6) {
          // Exponents / Powers (Squares and Cubes)
          if (Math.random() > 0.4) {
            const base = randInt(2, 9);
            question = `${base}²`;
            answer = base * base;
            visData = {
              type: 'square',
              base: base,
              title: 'GEOMETRIC AREA EXPONENT (SQUARE)',
              formulaStr: `${base}² = ${base} × ${base} = ${answer}`,
              hint: `• <b>Exponent Concept</b>: Multiply the base (${base}) by itself.<br>• <b>Area</b>: A square of side ${base} has area <b>${answer}</b>.`
            };
          } else {
            const base = randInt(2, 5);
            question = `${base}³`;
            answer = base * base * base;
            visData = {
              type: 'cube',
              base: base,
              title: '3D VOLUME EXPONENT (CUBE)',
              formulaStr: `V = ${base}³ = ${base} × ${base} × ${base} = ${answer}`,
              hint: `• <b>Cube Formula</b>: Volume = side³ = <b>${answer}</b>.<br>• <b>Geometry</b>: Isometric 3D cube with edge length ${base}.`
            };
          }
        } else {
          // Advanced Exponent & Compound Operations
          const type = randInt(1, 3);
          if (type === 1) {
            const a = randInt(2, 7);
            const b = randInt(3, 15);
            question = `${a}² + ${b}`;
            answer = (a * a) + b;
            visData = {
              type: 'compound',
              a: a,
              b: a,
              c: b,
              title: 'POWER WITH OFFSET ADDITION',
              formulaStr: `${a}² + ${b} = ${a*a} + ${b} = ${answer}`,
              hint: `• <b>Step 1 (Exponent)</b>: ${a}² = ${a * a}.<br>• <b>Step 2 (Addition)</b>: ${a * a} + ${b} = <b>${answer}</b>.`
            };
          } else if (type === 2) {
            const exp = randInt(4, 5);
            question = `2^${exp}`;
            answer = Math.pow(2, exp);
            const factors = Array(exp).fill(2).join(' × ');
            visData = {
              type: 'compound',
              title: 'BINARY EXPONENTIAL POWER',
              formulaStr: `2^${exp} = ${factors} = ${answer}`,
              hint: `• <b>Repeated Doubling</b>: 2 multiplied ${exp} times = <b>${answer}</b>.`
            };
          } else {
            const a = randInt(5, 12);
            const b = randInt(3, 8);
            const c = randInt(10, 30);
            question = `(${a} × ${b}) + ${c}`;
            answer = (a * b) + c;
            visData = {
              type: 'compound',
              a: a,
              b: b,
              c: c,
              title: 'ORDER OF OPERATIONS (PEMDAS)',
              formulaStr: `(${a} × ${b}) + ${c} = ${a*b} + ${c} = ${answer}`,
              hint: `• <b>Step 1 (Product)</b>: ${a} × ${b} = ${a * b}.<br>• <b>Step 2 (Addition)</b>: ${a * b} + ${c} = <b>${answer}</b>.`
            };
          }
        }
        break;
      }

      case 'lieutenant': {
        category = 'ROOTS & LOGARITHMS';
        if (waveLevel <= 2) {
          // Pure Radical Square Roots
          const rootPool = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
          const base = rootPool[randInt(0, rootPool.length - 1)];
          const sq = base * base;
          question = `√${sq}`;
          answer = base;
          visData = {
            type: 'root',
            sq: sq,
            base: base,
            title: 'RADICAL PRINCIPAL SQUARE ROOT',
            formulaStr: `√${sq} = ${base}`,
            hint: `• <b>Square Root Concept</b>: What positive number squared equals ${sq}?<br>• <b>Inverse Operation</b>: Since ${base}² = ${sq}, √${sq} = <b>${base}</b>.`
          };
        } else if (waveLevel <= 5) {
          // Fundamental Logarithms (Base 2, 3, 5, or 10)
          const baseChoices = [2, 2, 3, 5, 10];
          const base = baseChoices[randInt(0, baseChoices.length - 1)];
          let exp;
          if (base === 2) exp = randInt(2, 6); // 4, 8, 16, 32, 64
          else if (base === 3) exp = randInt(2, 4); // 9, 27, 81
          else if (base === 5) exp = randInt(2, 3); // 25, 125
          else exp = randInt(2, 3); // 100, 1000

          const val = Math.pow(base, exp);
          const baseSub = base === 10 ? '₁₀' : (base === 3 ? '₃' : (base === 5 ? '₅' : '₂'));
          question = `log${baseSub}( ${val} )`;
          answer = exp;
          const factors = Array(exp).fill(base).join(' × ');

          visData = {
            type: 'log',
            base: base,
            val: val,
            exp: exp,
            title: `LOGARITHMIC INVERSE SENSOR [BASE ${base}]`,
            formulaStr: `log${baseSub}(${val}) = ?   ⇄   ${base}^? = ${val}`,
            hint: `• <b>What is a Logarithm?</b>: It finds the <b>missing exponent</b> (how many times base ${base} multiplies itself to equal ${val}).<br>• <b>Exponential Bridge</b>: <b>${base}<sup>?</sup> = ${val}</b> ➔ <b>${factors} = ${val}</b> (${exp} factors of ${base}).<br>• <b>Logarithm Solution</b>: log<sub>${base}</sub>(${val}) = <b>${exp}</b>.`
          };
        } else {
          // Advanced Roots & Logarithm Harmonics
          const type = randInt(1, 3);
          if (type === 1) {
            const root = randInt(5, 15);
            const offset = randInt(3, 16);
            question = `√${root * root} + ${offset}`;
            answer = root + offset;
            visData = {
              type: 'root_offset',
              root: root,
              sq: root * root,
              offset: offset,
              title: 'RADICAL PRINCIPAL ROOT WITH OFFSET',
              formulaStr: `√${root * root} + ${offset} = ${root} + ${offset} = ${answer}`,
              hint: `• <b>Step 1 (Root)</b>: √${root * root} = ${root} (since ${root}² = ${root * root}).<br>• <b>Step 2 (Addition)</b>: ${root} + ${offset} = <b>${answer}</b>.`
            };
          } else if (type === 2) {
            const base = randInt(0, 1) === 0 ? 2 : 3;
            const exp = base === 2 ? randInt(3, 5) : randInt(2, 3);
            const val = Math.pow(base, exp);
            const offset = randInt(2, 8);
            const baseSub = base === 2 ? '₂' : '₃';
            question = `log${baseSub}( ${val} ) + ${offset}`;
            answer = exp + offset;
            const factors = Array(exp).fill(base).join(' × ');

            visData = {
              type: 'log',
              base: base,
              val: val,
              exp: exp,
              offset: offset,
              title: `LOGARITHMIC SENSOR EVALUATION`,
              formulaStr: `log${baseSub}(${val}) + ${offset} = ?`,
              hint: `• <b>Step 1 (Log)</b>: log<sub>${base}</sub>(${val}) asks "${base}<sup>?</sup> = ${val}". ${factors} = ${val} (${exp} factors), so log<sub>${base}</sub>(${val}) = <b>${exp}</b>.<br>• <b>Step 2 (Offset)</b>: ${exp} + ${offset} = <b>${answer}</b>.`
            };
          } else {
            // Advanced Quadratic Roots Sum & Product Harmonic
            const r1 = randInt(1, 4);
            const r2 = randInt(r1 + 2, 7);
            const bCoeff = r1 + r2;
            const cCoeff = r1 * r2;
            question = `x² - ${bCoeff}x + ${cCoeff} = 0 (root sum)`;
            answer = bCoeff;
            visData = {
              type: 'parabola',
              r1: r1,
              r2: r2,
              title: 'QUADRATIC ROOTS SUM HARMONIC',
              formulaStr: `(x - ${r1})(x - ${r2}) = 0 ➔ Roots: ${r1}, ${r2} ➔ Sum = ${bCoeff}`,
              hint: `• <b>Factoring</b>: (x - ${r1})(x - ${r2}) = 0 gives roots x = ${r1} and x = ${r2}.<br>• <b>Vieta's Formula</b>: Sum of roots (-b/a) = ${r1} + ${r2} = <b>${bCoeff}</b>.`
            };
          }
        }
        break;
      }

      case 'commander': {
        category = 'QUADRATICS & TRIGONOMETRY';
        if (waveLevel <= 2) {
          const type = randInt(1, 2);
          if (type === 1) {
            const m = randInt(2, 5);
            const b = randInt(2, 10);
            question = `f(x) = ${m}x + ${b}, f(2) = ?`;
            answer = (m * 2) + b;
            visData = {
              type: 'linear',
              m: m,
              b: b,
              x: 2,
              answer: answer,
              title: 'LINEAR FUNCTION EVALUATION',
              formulaStr: `f(x) = ${m}x + ${b}, f(2) = ${m}(2) + ${b} = ${answer}`,
              hint: `• <b>Linear Equation</b>: Substitute x = 2 into f(x) = ${m}x + ${b}.<br>• <b>Evaluation</b>: ${m}·(2) + ${b} = ${m*2} + ${b} = <b>${answer}</b>.`
            };
          } else {
            question = `sin(30°) × 10`;
            answer = 5;
            visData = {
              type: 'unit_circle',
              deg: 30,
              mult: 10,
              title: 'UNIT CIRCLE (30° ANGLE RATIO)',
              formulaStr: `sin(30°) × 10 = 0.5 × 10 = 5`,
              hint: `• <b>Unit Circle</b>: sin(30°) is the vertical ratio = 0.5 (1/2).<br>• <b>Scaled Output</b>: 0.5 × 10 = <b>5</b>.`
            };
          }
        } else if (waveLevel <= 5) {
          const r1 = randInt(2, 5);
          const r2 = randInt(r1 + 1, 8);
          question = `x² - ${r1 + r2}x + ${r1 * r2} = 0 (max root)`;
          answer = r2;
          visData = {
            type: 'parabola',
            r1: r1,
            r2: r2,
            title: 'PARABOLIC X-INTERCEPTS (ROOTS)',
            formulaStr: `(x - ${r1})(x - ${r2}) = 0 ➔ x = ${r1}, ${r2}`,
            hint: `• <b>Factoring</b>: (x - ${r1})(x - ${r2}) = 0.<br>• <b>Roots</b>: x = ${r1} and x = ${r2}. The maximum root is <b>${r2}</b>.`
          };
        } else {
          const type = randInt(1, 2);
          if (type === 1) {
            question = `cos(60°) × 24 + tan(45°) × 6`;
            answer = 12 + 6;
            visData = {
              type: 'unit_circle',
              deg: 60,
              title: 'TRIGONOMETRIC RATIO HARMONICS',
              formulaStr: `cos(60°)·24 + tan(45°)·6 = 12 + 6 = 18`,
              hint: `• <b>Special Angles</b>: cos(60°) = 0.5, tan(45°) = 1.0.<br>• <b>Combined Vectors</b>: (0.5 × 24) + (1.0 × 6) = 12 + 6 = <b>18</b>.`
            };
          } else {
            // Advanced Quadratic Roots Sum & Product Harmonic
            const r1 = randInt(1, 4);
            const r2 = randInt(r1 + 2, 7);
            const bCoeff = r1 + r2;
            const cCoeff = r1 * r2;
            question = `x² - ${bCoeff}x + ${cCoeff} = 0 (root sum)`;
            answer = bCoeff;
            visData = {
              type: 'parabola',
              r1: r1,
              r2: r2,
              title: 'QUADRATIC ROOTS SUM HARMONIC',
              formulaStr: `(x - ${r1})(x - ${r2}) = 0 ➔ Roots: ${r1}, ${r2} ➔ Sum = ${bCoeff}`,
              hint: `• <b>Factoring</b>: (x - ${r1})(x - ${r2}) = 0 gives roots x = ${r1} and x = ${r2}.<br>• <b>Vieta's Formula</b>: Sum of roots (-b/a) = ${r1} + ${r2} = <b>${bCoeff}</b>.`
            };
          }
        }
        break;
      }

      case 'admiral': {
        category = 'FLEET ADMIRAL CALCULUS MATRIX';
        if (waveLevel <= 2) {
          const type = randInt(1, 3);
          if (type === 1) {
            const b = randInt(2, 6);
            question = `d/dx (x² + ${b}x) at x=1`;
            answer = 2 + b;
            visData = {
              type: 'derivative',
              formulaStr: `f(x) = x² + ${b}x`,
              evalPoint: 1,
              poly: [1, b, 0],
              title: 'TANGENT SLOPE MATRIX (DERIVATIVE)',
              hint: `• <b>Concept</b>: The derivative d/dx gives the slope of the tangent line.<br>• <b>Power Rule</b>: d/dx(xⁿ) = n·xⁿ⁻¹, so d/dx(x² + ${b}x) = 2x + ${b}. At x=1, slope = 2(1) + ${b} = <b>${answer}</b>.`
            };
          } else if (type === 2) {
            const a = randInt(2, 4);
            question = `d/dx (${a}x²) at x=2`;
            answer = 4 * a;
            visData = {
              type: 'derivative',
              formulaStr: `f(x) = ${a}x²`,
              evalPoint: 2,
              poly: [a, 0, 0],
              title: 'QUADRATIC RATE OF CHANGE',
              hint: `• <b>Concept</b>: Instantaneous rate of change at x = 2.<br>• <b>Power Rule</b>: d/dx(${a}x²) = ${2*a}x. At x=2, slope = ${2*a}(2) = <b>${answer}</b>.`
            };
          } else {
            question = `∫ [0 to 2] (2x) dx`;
            answer = 4;
            visData = {
              type: 'integral',
              formulaStr: `f(x) = 2x`,
              from: 0,
              to: 2,
              func: (x) => 2 * x,
              title: 'DEFINITE INTEGRAL (SHADED AREA)',
              hint: `• <b>Concept</b>: Definite integral calculates total area under curve from x=0 to x=2.<br>• <b>Anti-derivative</b>: ∫ 2x dx = x² ➔ [2² - 0²] = <b>4</b>.`
            };
          }
        } else if (waveLevel <= 5) {
          const type = randInt(1, 3);
          if (type === 1) {
            const a = randInt(2, 4);
            const b = randInt(2, 6);
            question = `d/dx (${a}x² + ${b}x) at x=2`;
            answer = (4 * a) + b;
            visData = {
              type: 'derivative',
              formulaStr: `f(x) = ${a}x² + ${b}x`,
              evalPoint: 2,
              poly: [a, b, 0],
              title: 'POLYNOMIAL TANGENT DERIVATIVE',
              hint: `• <b>Concept</b>: Tangent line slope at x = 2.<br>• <b>Power Rule</b>: d/dx = ${2*a}x + ${b} ➔ ${2*a}(2) + ${b} = <b>${answer}</b>.`
            };
          } else if (type === 2) {
            const k = randInt(3, 5);
            question = `∫ [0 to ${k}] (2x) dx`;
            answer = k * k;
            visData = {
              type: 'integral',
              formulaStr: `f(x) = 2x`,
              from: 0,
              to: k,
              func: (x) => 2 * x,
              title: `DEFINITE INTEGRAL AREA [0 to ${k}]`,
              hint: `• <b>Concept</b>: Shaded area under f(x) = 2x from 0 to ${k}.<br>• <b>Anti-derivative</b>: F(x) = x² ➔ F(${k}) - F(0) = ${k}² = <b>${answer}</b>.`
            };
          } else {
            question = `d/dx (x³) at x=2`;
            answer = 12;
            visData = {
              type: 'derivative',
              formulaStr: `f(x) = x³`,
              evalPoint: 2,
              poly: [1, 0, 0, 0],
              title: 'CUBIC POWER RULE DERIVATIVE',
              hint: `• <b>Concept</b>: Instantaneous slope of cubic curve.<br>• <b>Power Rule</b>: d/dx(x³) = 3x² ➔ 3(2)² = 3(4) = <b>12</b>.`
            };
          }
        } else {
          const type = randInt(1, 3);
          if (type === 1) {
            const a = randInt(1, 2);
            const b = randInt(2, 5);
            const x = randInt(2, 3);
            question = `d/dx (${a}x³ - ${b}x) at x=${x}`;
            answer = (3 * a * x * x) - b;
            visData = {
              type: 'derivative',
              formulaStr: `f(x) = ${a}x³ - ${b}x`,
              evalPoint: x,
              poly: [a, 0, -b, 0],
              title: 'ADVANCED CUBIC POLYNOMIAL DERIVATIVE',
              hint: `• <b>Concept</b>: Tangent slope at x = ${x}.<br>• <b>Derivative</b>: d/dx = ${3*a}x² - ${b} ➔ ${3*a}(${x}²) - ${b} = <b>${answer}</b>.`
            };
          } else if (type === 2) {
            const k = randInt(2, 4);
            question = `∫ [0 to ${k}] (3x²) dx`;
            answer = k * k * k;
            visData = {
              type: 'integral',
              formulaStr: `f(x) = 3x²`,
              from: 0,
              to: k,
              func: (x) => 3 * x * x,
              title: 'PARABOLIC INTEGRATION AREA',
              hint: `• <b>Concept</b>: Area under f(x) = 3x² from x=0 to x=${k}.<br>• <b>Anti-derivative</b>: ∫ 3x² dx = x³ ➔ [${k}³ - 0³] = <b>${answer}</b>.`
            };
          } else {
            const a = randInt(2, 3);
            const b = randInt(3, 6);
            const x = randInt(2, 3);
            question = `d/dx (${a}x² + ${b}x) at x=${x}`;
            answer = (2 * a * x) + b;
            visData = {
              type: 'derivative',
              formulaStr: `f(x) = ${a}x² + ${b}x`,
              evalPoint: x,
              poly: [a, b, 0],
              title: 'FLEET ADMIRAL CALCULUS MATRIX',
              hint: `• <b>Concept</b>: Slope of tangent line at x = ${x}.<br>• <b>Derivative</b>: d/dx = ${2*a}x + ${b} ➔ ${2*a}(${x}) + ${b} = <b>${answer}</b>.`
            };
          }
        }
        break;
      }
    }

    // 100% Guaranteed Non-blocking Distractor Generation
    const used = new Set([answer]);
    let attempts = 0;
    const isBasicRank = (rank === 'ensign' || rank === 'lieutenant');

    while (distractors.length < 3 && attempts < 35) {
      attempts++;
      const delta = randInt(-8, 8);
      let d = answer + (delta === 0 ? (attempts % 2 === 0 ? randInt(1, 4) : -randInt(1, 4)) : delta);
      if (isBasicRank && d < 0) d = Math.abs(d) + randInt(1, 3);
      if (!used.has(d)) {
        used.add(d);
        distractors.push(d);
      }
    }

    let fallbackOffset = 1;
    while (distractors.length < 3) {
      let candidate = answer + (distractors.length % 2 === 0 ? fallbackOffset : -fallbackOffset);
      if (isBasicRank && candidate < 0) candidate = answer + fallbackOffset;
      if (!used.has(candidate)) {
        used.add(candidate);
        distractors.push(candidate);
      }
      fallbackOffset++;
    }

    const choices = [answer, ...distractors].sort(() => Math.random() - 0.5);

    return {
      question,
      category,
      answer,
      choices,
      visData
    };
  }

  static renderGraph(canvas, visData, hideAnswers = false) {
    if (!canvas || !visData) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = 340;
    const cssH = 200;

    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const W = cssW;
    const H = cssH;

    ctx.clearRect(0, 0, W, H);

    // Deep Cosmic Navy LCARS Canvas
    ctx.fillStyle = '#040711';
    ctx.fillRect(0, 0, W, H);

    // Subtle Sci-Fi Grid Lines
    ctx.strokeStyle = 'rgba(136, 170, 204, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 20; x < W; x += 28) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 20; y < H; y += 28) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Default axes reference
    const originX = 42;
    const originY = H - 32;

    /* =========================================================================
       1. ENHANCED LOGARITHMIC SENSOR MATRIX VISUALIZER (The Magic Bridge)
       ========================================================================= */
    if (visData.type === 'log') {
      const base = visData.base || 2;
      const val = visData.val || 16;
      const exp = visData.exp || 4;
      const isLn = visData.isLn || false;
      const baseLabel = isLn ? 'e' : (base === 10 ? '10' : (base === 2 ? '2' : (base === 3 ? '3' : String(base))));
      const subLabel = isLn ? 'e' : (base === 10 ? '₁₀' : (base === 3 ? '₃' : (base === 5 ? '₅' : '₂')));

      // (A) Top LCARS Dual Equation Bridge Pill: [ log_b(N) = ? ] <==> [ b^? = N ]
      ctx.fillStyle = '#081220';
      ctx.strokeStyle = '#33ccff';
      ctx.lineWidth = 1.5;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(8, 6, W - 16, 28, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(8, 6, W - 16, 28);
        ctx.strokeRect(8, 6, W - 16, 28);
      }

      ctx.font = 'bold 11px "Orbitron", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#33ccff';
      ctx.fillText(isLn ? `ln(${val}) = ?` : `log${subLabel}(${val}) = ?`, 18, 24);

      ctx.fillStyle = '#ffaa00';
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px "Orbitron", sans-serif';
      ctx.fillText('⇄', W / 2, 24);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#33ff66';
      ctx.fillText(`${baseLabel}^? = ${val}`, W - 18, 24);

      // (B) Coordinate Plane Dimensions
      const plotLeft = 40;
      const plotRight = W - 16;
      const plotTop = 46;
      const plotBottom = H - 26;
      const plotW = plotRight - plotLeft;
      const plotH = plotBottom - plotTop;

      const maxVal = Math.max(val * 1.15, Math.pow(base, exp + 0.5));
      const maxExp = Math.max(exp + 1.2, 4.5);

      const scaleX = plotW / maxVal;
      const scaleY = plotH / maxExp;

      // Draw Axes
      ctx.strokeStyle = 'rgba(136, 170, 204, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(plotLeft, plotBottom); ctx.lineTo(plotRight, plotBottom); // X-axis (Target N)
      ctx.moveTo(plotLeft, plotBottom); ctx.lineTo(plotLeft, plotTop - 4); // Y-axis (Power y)
      ctx.stroke();

      ctx.fillStyle = '#8da4bc';
      ctx.font = 'bold 9px "Share Tech Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('Target Value (N)', plotRight, plotBottom + 14);
      ctx.textAlign = 'left';
      ctx.fillText('Power (y)', plotLeft - 4, plotTop - 6);
      ctx.fillText('0', plotLeft - 10, plotBottom + 10);

      // (C) Smooth Neon Cyan Logarithmic Curve: y = log_b(x)
      ctx.beginPath();
      ctx.strokeStyle = '#33ccff';
      ctx.lineWidth = 2.5;

      const stepCount = 50;
      let first = true;
      for (let i = 0; i <= stepCount; i++) {
        const currX = 0.5 + (i / stepCount) * (maxVal - 0.5);
        const currY = isLn ? Math.log(currX) : (Math.log(currX) / Math.log(base));
        if (currY < 0) continue;
        const scrX = plotLeft + currX * scaleX;
        const scrY = plotBottom - currY * scaleY;
        if (first) {
          ctx.moveTo(scrX, scrY);
          first = false;
        } else {
          ctx.lineTo(scrX, scrY);
        }
      }
      ctx.stroke();

      // (D) Intermediate Power Steps (1, b^1, b^2, b^3...)
      for (let k = 1; k <= exp; k++) {
        const stepVal = Math.pow(base, k);
        const scrX = plotLeft + stepVal * scaleX;
        const scrY = plotBottom - k * scaleY;

        if (scrX <= plotRight && scrY >= plotTop) {
          if (k === exp) {
            // TARGET SOLUTION POINT (Glowing Gold Reticle)
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);

            // Vertical guideline down to X-axis
            ctx.beginPath();
            ctx.moveTo(scrX, plotBottom);
            ctx.lineTo(scrX, scrY);
            ctx.stroke();

            // Horizontal guideline across to Y-axis
            ctx.beginPath();
            ctx.moveTo(plotLeft, scrY);
            ctx.lineTo(scrX, scrY);
            ctx.stroke();
            ctx.setLineDash([]); // Reset line dash

            // Target Point Node
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(scrX, scrY, 5.5, 0, Math.PI * 2);
            ctx.fill();

            // Outer target halo
            ctx.strokeStyle = '#33ff66';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(scrX, scrY, 9, 0, Math.PI * 2);
            ctx.stroke();

            // Coordinate Drop Labels
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 11px "Orbitron", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${val}`, scrX, plotBottom + 13);

            ctx.fillStyle = '#33ff66';
            ctx.textAlign = 'right';
            ctx.fillText(hideAnswers ? '? = [?]' : `? = ${exp}`, plotLeft - 4, scrY + 4);

            // Callout Beacon Label
            ctx.fillStyle = '#33ff66';
            ctx.font = 'bold 10px "Orbitron", sans-serif';
            ctx.textAlign = scrX > plotLeft + plotW * 0.6 ? 'right' : 'left';
            const calloutX = scrX > plotLeft + plotW * 0.6 ? scrX - 12 : scrX + 12;
            ctx.fillText(hideAnswers ? `★ TARGET: ${baseLabel}^? = ${val}` : `★ TARGET: ${baseLabel}^${exp} = ${val}`, calloutX, scrY - 4);

          } else {
            // Intermediate power step dots
            ctx.fillStyle = '#aa88dd';
            ctx.beginPath();
            ctx.arc(scrX, scrY, 3.5, 0, Math.PI * 2);
            ctx.fill();

            if (k <= 3 || exp <= 4) {
              ctx.fillStyle = '#8da4bc';
              ctx.font = '9px "Share Tech Mono", monospace';
              ctx.textAlign = 'center';
              ctx.fillText(`${baseLabel}^${k}=${stepVal}`, scrX, scrY - 6);
            }
          }
        }
      }

      // (E) Bottom Factor Chain: "2 × 2 × 2 × 2 = 16 (4 factors)"
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 9.5px "Share Tech Mono", monospace';
      ctx.textAlign = 'left';
      const factorsText = hideAnswers 
        ? `${baseLabel} × ... × ${baseLabel} = ${val} ([?] factors)`
        : (Array(exp).fill(baseLabel).join(' × ') + ` = ${val} (${exp} factors of ${baseLabel})`);
      ctx.fillText(`⚡ ${factorsText}`, plotLeft + 6, plotBottom - 6);

    /* =========================================================================
       2. GEOMETRIC SQUARE AREA VISUALIZER (base²)
       ========================================================================= */
    } else if (visData.type === 'square') {
      const base = visData.base || 4;
      const size = Math.min(100, Math.max(50, base * 12));
      const cx = W / 2;
      const cy = (H / 2) + 6;
      const left = cx - size / 2;
      const top = cy - size / 2;

      ctx.fillStyle = 'rgba(217, 125, 85, 0.25)';
      ctx.fillRect(left, top, size, size);

      ctx.strokeStyle = '#d97d55';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(left, top, size, size);

      // Inner sub-grid
      ctx.strokeStyle = 'rgba(217, 125, 85, 0.35)';
      ctx.lineWidth = 1;
      const cell = size / base;
      for (let i = 1; i < base; i++) {
        ctx.beginPath(); ctx.moveTo(left + i * cell, top); ctx.lineTo(left + i * cell, top + size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(left, top + i * cell); ctx.lineTo(left + size, top + i * cell); ctx.stroke();
      }

      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 13px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hideAnswers ? `Area = ${base} × ${base} = ???` : `Area = ${base} × ${base} = ${base * base}`, cx, cy + 4);

      ctx.fillStyle = '#88aacc';
      ctx.font = 'bold 11px "Share Tech Mono", monospace';
      ctx.fillText(`Side = ${base}`, cx, top - 6);
      ctx.textAlign = 'right';
      ctx.fillText(`Side = ${base}`, left - 8, cy + 4);

    /* =========================================================================
       3. 3D ISOMETRIC CUBE VOLUME VISUALIZER (base³)
       ========================================================================= */
    } else if (visData.type === 'cube') {
      const base = visData.base || 3;
      const cx = W / 2;
      const cy = (H / 2) + 8;
      const s = Math.min(65, Math.max(35, base * 10));
      const dx = s * 0.7;
      const dy = s * 0.4;

      // Top Face
      ctx.fillStyle = 'rgba(136, 170, 204, 0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + dx, cy - s - dy);
      ctx.lineTo(cx, cy - s - 2 * dy);
      ctx.lineTo(cx - dx, cy - s - dy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#88aacc';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Front Left Face
      ctx.fillStyle = 'rgba(217, 125, 85, 0.4)';
      ctx.beginPath();
      ctx.moveTo(cx - dx, cy - s - dy);
      ctx.lineTo(cx, cy - s);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx - dx, cy - dy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d97d55';
      ctx.stroke();

      // Front Right Face
      ctx.fillStyle = 'rgba(204, 119, 153, 0.4)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + dx, cy - s - dy);
      ctx.lineTo(cx + dx, cy - dy);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#cc7799';
      ctx.stroke();

      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 12px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hideAnswers ? `Volume = ${base}³ = ???` : `Volume = ${base}³ = ${base * base * base}`, cx, cy + 24);

    /* =========================================================================
       4. RADICAL PRINCIPAL ROOT (√sq = base)
       ========================================================================= */
    } else if (visData.type === 'root' || visData.type === 'root_offset') {
      const sq = visData.sq || (visData.base * visData.base) || 16;
      const base = visData.base || visData.root || Math.round(Math.sqrt(sq));
      const cx = W / 2;
      const cy = H / 2;
      const size = 80;

      ctx.fillStyle = 'rgba(51, 204, 255, 0.2)';
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      ctx.strokeStyle = '#33ccff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 14px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Area = ${sq}`, cx, cy - 2);

      ctx.fillStyle = '#33ff66';
      ctx.font = 'bold 11px "Orbitron", sans-serif';
      ctx.fillText(hideAnswers ? `Side Root = √${sq} = ???` : `Side Root = √${sq} = ${base}`, cx, cy + size / 2 + 18);

    /* =========================================================================
       5. DERIVATIVE TANGENT SLOPE MATRIX
       ========================================================================= */
    } else if (visData.type === 'derivative') {
      const evalX = visData.evalPoint || 1;
      const poly = visData.poly || [1, 3, 0];
      const scaleX = (W - 80) / 4.0;
      const scaleY = (H - 70) / (evalX === 1 ? 16 : 40);

      const getY = (x) => {
        if (poly.length === 3) return poly[0] * x * x + poly[1] * x + poly[2];
        if (poly.length === 4) return poly[0] * x * x * x + poly[2] * x;
        return poly[0] * x * x;
      };

      ctx.strokeStyle = '#88aacc';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(W - 15, originY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(originX, 15); ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = '#88aacc';
      ctx.lineWidth = 3;
      for (let px = 0; px <= 3.8; px += 0.05) {
        const py = getY(px);
        const scrX = originX + px * scaleX;
        const scrY = originY - py * scaleY;
        if (px === 0) ctx.moveTo(scrX, scrY);
        else ctx.lineTo(scrX, scrY);
      }
      ctx.stroke();

      const curY = getY(evalX);
      const evalScrX = originX + evalX * scaleX;
      const evalScrY = originY - curY * scaleY;

      const dx = 1.0;
      let slope = 0;
      if (poly.length === 3) slope = 2 * poly[0] * evalX + poly[1];
      else if (poly.length === 4) slope = 3 * poly[0] * evalX * evalX + poly[2];
      else slope = 2 * poly[0] * evalX;

      const tX1 = originX + (evalX - dx) * scaleX;
      const tY1 = originY - (curY - slope * dx) * scaleY;
      const tX2 = originX + (evalX + dx) * scaleX;
      const tY2 = originY - (curY + slope * dx) * scaleY;

      ctx.strokeStyle = '#d97d55';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(tX1, tY1);
      ctx.lineTo(tX2, tY2);
      ctx.stroke();

      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(evalScrX, evalScrY, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 11px "Orbitron", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Target: x = ${evalX}`, evalScrX + 10, evalScrY - 8);
      ctx.fillStyle = '#d97d55';
      ctx.fillText(hideAnswers ? `Tangent Slope = ???` : `Tangent Slope = ${slope}`, evalScrX + 10, evalScrY + 8);

    /* =========================================================================
       6. DEFINITE INTEGRAL RIEMANN AREA
       ========================================================================= */
    } else if (visData.type === 'integral') {
      const from = visData.from || 0;
      const to = visData.to || 2;
      const func = visData.func || ((x) => 2 * x);
      const scaleX = (W - 80) / (to + 1.2);
      const maxY = func(to);
      const scaleY = (H - 70) / (maxY * 1.1);

      ctx.strokeStyle = '#88aacc';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(W - 15, originY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(originX, 15); ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(originX + from * scaleX, originY);
      for (let px = from; px <= to; px += 0.05) {
        const py = func(px);
        ctx.lineTo(originX + px * scaleX, originY - py * scaleY);
      }
      ctx.lineTo(originX + to * scaleX, originY);
      ctx.closePath();

      ctx.fillStyle = 'rgba(51, 255, 102, 0.25)';
      ctx.fill();

      ctx.strokeStyle = 'rgba(51, 255, 102, 0.4)';
      ctx.lineWidth = 1.5;
      for (let px = from; px <= to; px += 0.2) {
        const py = func(px);
        ctx.beginPath();
        ctx.moveTo(originX + px * scaleX, originY);
        ctx.lineTo(originX + px * scaleX, originY - py * scaleY);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.strokeStyle = '#33ff66';
      ctx.lineWidth = 3;
      for (let px = 0; px <= to + 0.8; px += 0.05) {
        const py = func(px);
        const scrX = originX + px * scaleX;
        const scrY = originY - py * scaleY;
        if (px === 0) ctx.moveTo(scrX, scrY);
        else ctx.lineTo(scrX, scrY);
      }
      ctx.stroke();

      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 11px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`[x=0]`, originX, originY + 16);
      ctx.fillText(`[x=${to}]`, originX + to * scaleX, originY + 16);
      ctx.fillStyle = '#33ff66';
      ctx.textAlign = 'left';
      ctx.fillText(hideAnswers ? `Shaded Area = ∫ f(x) dx = ???` : `Shaded Area = ∫ f(x) dx`, originX + 20, 38);

    /* =========================================================================
       7. UNIT CIRCLE TRIGONOMETRY
       ========================================================================= */
    } else if (visData.type === 'unit_circle') {
      const cx = W / 2;
      const cy = H / 2;
      const R = 64;

      ctx.strokeStyle = '#88aacc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      const deg = visData.deg || 30;
      const rad = (deg * Math.PI) / 180;
      const px = cx + R * Math.cos(rad);
      const py = cy - R * Math.sin(rad);

      ctx.strokeStyle = '#d97d55';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();

      ctx.strokeStyle = '#33ff66';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, py); ctx.stroke();

      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 11px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hideAnswers ? `${deg}° (sin vertical ratio = ???)` : `${deg}° (sin vertical ratio = ${Math.sin(rad).toFixed(2)})`, cx, cy - R - 8);

    /* =========================================================================
       8. PARABOLA QUADRATIC ROOTS
       ========================================================================= */
    } else if (visData.type === 'parabola') {
      const r1 = visData.r1 || 2;
      const r2 = visData.r2 || 5;
      const scaleX = (W - 80) / (r2 + 2);
      const scaleY = 16;

      ctx.strokeStyle = '#cc7799';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= r2 + 1.5; x += 0.1) {
        const y = (x - r1) * (x - r2);
        const scrX = originX + x * scaleX;
        const scrY = (originY - 35) + y * scaleY;
        if (x === 0) ctx.moveTo(scrX, scrY);
        else ctx.lineTo(scrX, scrY);
      }
      ctx.stroke();

      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(originX + r1 * scaleX, originY - 35, 5, 0, Math.PI * 2);
      ctx.arc(originX + r2 * scaleX, originY - 35, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 11px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hideAnswers ? `Root: ?` : `Root: ${r1}`, originX + r1 * scaleX, originY - 46);
      ctx.fillText(hideAnswers ? `Root: ?` : `Root: ${r2}`, originX + r2 * scaleX, originY - 46);

    /* =========================================================================
       9. DEFAULT LCARS DIAGNOSTIC
       ========================================================================= */
    } else {
      ctx.fillStyle = '#88aacc';
      ctx.font = 'bold 13px "Orbitron", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(visData.title || 'LCARS TACTICAL DIAGNOSTIC', originX + 10, 50);
      ctx.fillStyle = '#8da4bc';
      ctx.font = '11px "Share Tech Mono", monospace';
      ctx.fillText('Sensor array analyzing mathematical coordinates...', originX + 10, 75);
    }
    ctx.restore();
  }
}
