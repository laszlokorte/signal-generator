<script>
	import {onMount} from 'svelte'
	import Graph from './Graph.svelte'
	import {fft, fftInverse, fftShift} from './fft.js'

	const zip = (x, y) => Array(Math.max(x.length, y.length)).fill().map((_,i) => [x[i], y[i]]);
	
	let filter = {
		a: [0.6,-0.6,0,0,0],
		b: [1,0,0,0,0]
	}
	
	function reset() {
		index = 0
		bufferX.fill(0)
		bufferY.fill(0)
		outputX.fill(0)
		outputY.fill(0)
		
		bufferX[0] = 0
		outputX[0] = 0
		bufferY[0] = 0
		outputY[0] = 0
	}
	
	let svgScreen = null
	$: svgPoint = svgScreen && svgScreen.createSVGPoint()
	let basis= false
	let trace= false
	let follow = true
	let complex = true
	let pause = true
	let pressed = false
	let bufferLength = 128
	let time = bufferLength-1
	let windowWidth = 1
	let windowHeight = 1
	$: windowSize = Math.min(windowHeight, windowWidth)
	let mouseX = 100
	let mouseY = 100
	$: mouseXRel = mouseX - bufferXMax/2
	$: mouseYRel = mouseY - bufferYMax/2
	$: mouseRadius = Math.sqrt(mouseXRel*mouseXRel+mouseYRel*mouseYRel+1)
	let index = 0
	let bufferX = Array(bufferLength).fill(0);
	let bufferY = Array(bufferLength).fill(0);
	let outputX = Array(bufferLength).fill(0);
	let outputY = Array(bufferLength).fill(0);
	$: outputComplex = zip(outputX, outputY)
	$: outputComplexMag = outputComplex.map(([re,im]) => Math.sqrt(re*re+im*im))
	$: outputComplexPhase = outputComplex.map(([re,im]) => Math.atan2(im,re))
	$: bufferComplex = zip(bufferX, bufferY)
	$: bufferMag = bufferComplex.map(([re,im]) => Math.sqrt(re*re+im*im))
	$: bufferPhase = bufferComplex.map(([re,im]) => Math.atan2(im,re))
	$: spectrumX = fftShift(fft(bufferX.map((re) => [re,0])));
	$: spectrumY = fftShift(fft(bufferY.map((re) => [re,0])));
	
	$: spectrumComplex = fftShift(fft(bufferComplex));
	$: spectrumComplexPolar = spectrumComplex.map(([re,im]) => ({mag: Math.sqrt(re*re+im*im), phase: Math.atan2(im,re)}))
	$: spectrumComplexMag = spectrumComplexPolar.map(({mag}) => mag)
	$: spectrumComplexPhase = spectrumComplexPolar.map(({phase}) => phase)

	const scl = Math.sqrt(2*bufferLength)

	$: spectrumComplexPartialSum = spectrumComplexPolar.reduce(([[px,py,m], ...lst], {mag, phase}, f) => [[px+2*mag/scl*Math.cos((time+index)%bufferLength*(f-bufferLength/2)*2*Math.PI/bufferLength+phase), py+2*mag/scl*Math.sin((time+index)%bufferLength*2*(f-bufferLength/2)*Math.PI/bufferLength+phase),2*mag/scl], [px,py,m], ...lst], [[0,0]])


	$: spectrumXMag = spectrumX.map(([re,im]) => Math.sqrt(re*re+im*im))
	$: spectrumYMag = spectrumY.map(([re,im]) => Math.sqrt(re*re+im*im))
	
	$: spectrumXPhase = spectrumX.map(([re,im]) => Math.atan2(im,re))
	$: spectrumYPhase = spectrumY.map(([re,im]) => Math.atan2(im,re))
	
	let phaseMax = Math.PI*2
	
	$: spectrumMax = Math.max(1, ...spectrumXMag, ...spectrumYMag, ...spectrumComplexMag)
	
	$: bufferXMax = windowSize
	$: bufferYMax = windowSize
	$: bufferMax = Math.max(1, bufferXMax, bufferYMax)
	$: bufferMagMax = Math.sqrt(bufferXMax*bufferXMax + bufferYMax*bufferYMax+1)
	
	$: spectrumComplexMagLog = spectrumComplexMag.map((f) => Math.log(f+0.000001))
	$: cepstrumComplex = fftShift(fftInverse(spectrumComplexMagLog.map(x => [x,0])).map(([re,im]) => Math.sqrt(re*re+im*im)))
	$: cepstrumComplexMax = Math.max(1, ...cepstrumComplex)
	
	$: spectrumXMagLog = spectrumXMag.map((f) => Math.log(f+0.000001))
	$: spectrumYMagLog = spectrumYMag.map((f) => Math.log(f+0.000001))
	
	$: cepstrumX = fftShift(fftInverse(spectrumXMagLog.map(x => [x,0])).map(([re,im]) => Math.sqrt(re*re+im*im)))
	$: cepstrumY = fftShift(fftInverse(spectrumYMagLog.map(x => [x,0])).map(([re,im]) => Math.sqrt(re*re+im*im)))
	$: cepstrumXYMax = Math.max(1, ...cepstrumX, ...cepstrumY)

	
	function mouseMove(evt) {
		svgPoint.x = evt.clientX;
		svgPoint.y = evt.clientY;
		const ctm = svgScreen.getScreenCTM().inverse();
		const p =  svgPoint.matrixTransform(ctm);

		mouseX = p.x
		mouseY = p.y
	}	
	function mouseDown(evt) {
		evt.preventDefault()
		pressed = true
	}
	
	function mouseUp(evt) {
		pressed = false
	}
	
	function applyFilter(x, y, index, filter) {
		return filter.b.reduce((acc, coef, i) => acc + coef * x[(index-i+2*x.length)%x.length], 0) + 
			filter.a.reduce((acc, coef, i) => acc + coef * y[(index-i-1+2*y.length)%y.length], 0)
	}
	
	onMount(() => {
		let af = null
		const tick = () => {
			if(pause && !pressed) return;
			
			bufferX[index] = mouseX - bufferXMax/2
			bufferY[index] = mouseY - bufferYMax/2
			
			outputX[index] = applyFilter(bufferX, outputX, index, filter)
			outputY[index] = applyFilter(bufferY, outputY, index, filter)
						
			index = ++index % bufferX.length
		}
			
		const afCb = () => {
			tick()
			af = window.requestAnimationFrame(afCb)
		}
		
		af = afCb()
				
		return () => {
			window.cancelAnimationFrame(af)
		}
	})
</script>

<style>
	:global(body) {
		background: #333;
		margin: 0;
		padding: 0;
		color: #fff;
	}

	h1 {
		margin: 0;
	}
	
	h2 {
		margin: 0;
		font-size: 1.1em;
	}

	.app {
		display: grid;
		grid-template-columns: 1fr 2fr;
		grid-template-rows: 1fr;
		grid-template-areas: "left right";
		align-content: stretch;
		justify-content: stretch;
		align-items: stretch;
		justify-items: stretch;
		padding: 1em;
		height: 100vh;
		box-sizing: border-box;
	}

	footer {
		margin: 1em 0;
	}
	
	.screen {
		inset: 0;
		pointer-events: none;
		z-index: 0;
		grid-area: right;
		width: 100%;
		height: 100%;
		max-height: 100vh;
	}

	input[type=range] {
		margin: 0;
		padding: 0;
	}
	
	.graph {
		background: #0005;
		height: 6em;
		width: 100%;
		display: block;
	}
	
	svg {
		margin: 0;
	}

	button {
		border: 1px solid #aaa;
		background: #333;
		color: #fff;
		cursor: pointer;
	}
	
	.controls {
		grid-area: left;
		background-color: #0006;
		z-index: 3;
		padding: 1em;
		color: #fff;
	}

	a {
		color: inherit;
		text-decoration: underline;
	}
	
	.grid {
		display: grid;
		grid-template-columns: minmax(100px, max-content) repeat(auto-fill, minmax(5em, 1fr));
		grid-auto-flow: row;
		justify-items: stretch;
		justify-content: start;
		align-items: center;
		align-content: center;
		gap: 0.5em;
		margin: 1em 0;
	}
	
	input[type=number] {
		margin: 0;
	}
	
	.row {
		display: flex;
		justify-items: baseline;
		align-items: baseline;
		align-content: baseline;
		justify-content: baseline;
		gap: 1em;
	}
	
	.grid-head {
		grid-column: 1;
		justify-self: end;
		word-wrap: nowrap;
		word-break: none;
		white-space: pre;
	}

	details {
		margin: 1em 0;
	}

	summary {
		cursor: pointer;
	}
</style>

<svelte:window on:mousemove={mouseMove} on:mousedown={mouseDown} on:mouseup={mouseUp} bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

<div class="app">
	
<svg bind:this={svgScreen} viewBox="0 0 {windowSize} {windowSize}" preserveAspectRatio="xMidYMid meet" class="screen">

{#if trace}
<g>
	{#each bufferX.slice(1) as _, i}
<line x1={bufferX[(i+index)%bufferLength]+bufferXMax/2} y1={bufferY[(i+index)%bufferLength]+bufferYMax/2} x2={bufferX[(i+1+index)%bufferLength]+bufferXMax/2} y2={bufferY[(i+1+index)%bufferLength]+bufferYMax/2} stroke="cyan" opacity="0.5"/>
{/each}
</g>

<g>
	{#each outputX.slice(1) as _, i}
<line x1={outputX[(i+index)%bufferLength]+bufferXMax/2} y1={outputY[(i+index)%bufferLength]+bufferYMax/2} x2={outputX[(i+1+index)%bufferLength]+bufferXMax/2} y2={outputY[(i+1+index)%bufferLength]+bufferYMax/2} stroke="yellow" opacity="0.5"/>
{/each}
</g>
{/if}

{#if basis}
<g>
	<circle r={4} fill="red" cx="{spectrumComplexPartialSum[spectrumComplexPartialSum.length-1][0]+bufferXMax/2}" cy="{spectrumComplexPartialSum[spectrumComplexPartialSum.length-1][1]+bufferYMax/2}"/>

	{#each spectrumComplexPartialSum as [x,y,m], i}
<line 
x1="{x+bufferXMax/2}" 
y1="{y+bufferYMax/2}" 
x2="{spectrumComplexPartialSum[(i-1+spectrumComplexPartialSum.length)%(spectrumComplexPartialSum.length)][0]+bufferXMax/2}" 
y2="{spectrumComplexPartialSum[(i-1+spectrumComplexPartialSum.length)%(spectrumComplexPartialSum.length)][1]+bufferYMax/2}"
 stroke="red" opacity={i/spectrumComplexPartialSum.length}/>
<circle stroke-width="2" fill-opacity="0.1" opacity={i/spectrumComplexPartialSum.length} r={m} fill="red" stroke="red" cx="{x+bufferXMax/2}" cy="{y+bufferYMax/2}"/>
{/each}
</g>
{/if}

{#if complex}
	<path vector-effect="non-scaling-stroke"  d="M{bufferXMax/2},{bufferYMax/2} h{400} a {400} {400} 0 0 {mouseYRel>0?1:0} {400*mouseXRel/mouseRadius-400} {400*mouseYRel/mouseRadius}" fill="magenta" fill-opacity="0.2" stroke-width="2" transform="translate({bufferXMax/2}, {bufferYMax/2}) scale(0.1) translate({-bufferXMax/2}, {-bufferYMax/2})"/>

<path vector-effect="non-scaling-stroke" d="M{bufferXMax/2},{bufferYMax/2} m{400},0 a {400} {400} 0 0 {mouseYRel>0?1:0} {400*mouseXRel/mouseRadius-400} {400*mouseYRel/mouseRadius}" stroke="magenta" stroke-width="3" transform="translate({bufferXMax/2}, {bufferYMax/2}) scale(0.1) translate({-bufferXMax/2}, {-bufferYMax/2})" fill="none" />
	<path vector-effect="non-scaling-stroke"  d="M{bufferXMax/2},{bufferYMax/2} L{mouseX},{mouseY}" stroke="cyan" stroke-width="2" />

<circle cx="{mouseX}" cy="{mouseY}" r="4" fill="#fff" />
	<text x="{bufferXMax/4 + mouseX/2}" y="{bufferYMax/4 + mouseY/2}" fill="cyan" text-anchor="middle" dominant-baseline="top" transform="rotate({180/Math.PI*Math.atan2(mouseYRel,mouseXRel)},{bufferXMax/4 + mouseX/2},{bufferYMax/4 + mouseY/2})">Magnitude</text>
	<circle cx="{bufferXMax/2}" cy="{bufferYMax/2}" r="{bufferMax/3}" stroke="white" fill="none" opacity="0.2" stroke-dasharray="10 10" />
<circle cx="{bufferXMax/2 + outputX[(index-1+bufferLength)%bufferLength]}" cy="{bufferYMax/2 + outputY[(index-1+bufferLength)%bufferLength]}" r="15" fill="yellow" opacity="0.3" />

<circle cx="{bufferXMax/2 + outputX[(index-1+bufferLength)%bufferLength]}" cy="{bufferYMax/2 + outputY[(index-1+bufferLength)%bufferLength]}" r="6" fill="yellow" />
{:else}
<path vector-effect="non-scaling-stroke"  d="M{mouseX},{mouseY} V{bufferYMax/2}" stroke="#f08" stroke-width="2" />
<path vector-effect="non-scaling-stroke"  d="M{mouseX},{bufferYMax/2} H{bufferXMax/2}" stroke="#8f0" stroke-width="2" />
<circle cx="{mouseX}" cy="{mouseY}" r="4" fill="#fff" />
	<text x="{mouseX/2 + bufferXMax/4}" y="{bufferYMax/2 - 10}" fill="#8f0"  text-anchor="end" dominant-baseline="top">Mouse X</text>
	<text x="{mouseX + 5}" y="{bufferYMax/4 + mouseY/2}" fill="#f08" text-anchor="start">Mouse Y</text>
	<circle cx="{bufferXMax/2}" cy="{bufferYMax/2}" r="{bufferMax/3}" stroke="white" fill="none" opacity="0.2" stroke-dasharray="10 10" />
<circle cx="{bufferXMax/2 + outputX[(index-1+bufferLength)%bufferLength]}" cy="{bufferYMax/2 + outputY[(index-1+bufferLength)%bufferLength]}" r="15" fill="yellow" opacity="0.3" />

<circle cx="{bufferXMax/2 + outputX[(index-1+bufferLength)%bufferLength]}" cy="{bufferYMax/2 + outputY[(index-1+bufferLength)%bufferLength]}" r="6" fill="yellow" />
{/if}
</svg>

<div class="controls" on:mousedown|stopPropagation>
	
	<h1>Signal Generator</h1>

	<details>
		<summary>Introduction</summary>
		<p>
			Click an drag with your mouse on the right side of the screen to record your mouse position as a two dimensional signal.
		</p>
		<p>
			The uppermost graph shows the position of your mouse over time, either as complex (magnitude&amp;phase) value or as two separate x and y values.
		</p>
		<p>
			The position is only recorded while the mouse button is pressed down. This allows you to record high frequency signals by stop recording, then moving the cursor a larger distance and then continue recording by pressing the mouse button again. To record even if you do not press your mouse button, uncheck the <em>pause</em> checkbox.
		</p>
		<p>
			The magnitude and phase spectra are computed via discrete fourier transform (dft) of the mouse position. 
		</p>
		<p>
			You may notice that while recording your mouse position a yellow dot follows your cursor. The position of the yellow dot is calculated by applying an auto-regressive/moving-average filter to the signal of mouse positions. You can control the movement my changing the filter coefficients.
		</p>
	</details>

	<h2>Options</h2>
	<div class="row">
		<label><input type="checkbox" bind:checked={follow} /> Scroll Graph</label>
		<label><input type="checkbox" bind:checked={pause} /> Pause</label>
		<label><input type="checkbox" bind:checked={complex} /> Complex Signal</label>
		<label><input type="checkbox" bind:checked={basis} /> Show Basis</label>
		<label><input type="checkbox" bind:checked={trace} /> Show Trace</label>
		
		<button style="margin-left: auto" on:click={reset}>
			reset
		</button>
	</div>

		{#if basis}
		<div class="row">
			<label>Time: <input type="range" min="0" max="{bufferLength-1}" step="0.01" bind:value={time} /></label>
		</div>
		{/if}
	
{#if complex}
		
<h2>
	Complex Mouse Position (magnitude and phase)
</h2>
<Graph data={[
	{color: 'cyan', samples: bufferMag, min:0, max: bufferMagMax},
	{color: 'magenta', samples: bufferPhase, min:Math.PI, max: -Math.PI},
]} offset={index} follow={follow} />
	{:else}	
<h2>
	Mouse Position Signals (x and y)
</h2>
<Graph data={[
	{color: '#8f0', samples: bufferX, min:-bufferXMax/2, max: bufferXMax/2},
	{color: '#f08', samples: bufferY, min:bufferYMax/2, max: -bufferYMax/2},
]} offset={index} follow={follow} />
{/if}
{#if complex}
<h2>
	FFT Magnitude Spectrum
</h2>
	<svg viewBox="-3 -3 {bufferLength+10} {40+5}" width="400" height="100" class="graph" preserveAspectRatio="none">
		<path d="{spectrumComplexMag.map((v,i) => `M${(i+bufferLength)%bufferLength+1},40 v${-v/spectrumMax*40}`).join('')}z" stroke="cyan" stroke-width="1" opacity="0.6" />
		<path  d="M0,0V40H{bufferLength+3}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
	</svg>
<h2>
	FFT Phase Spectrum
</h2>
	<svg viewBox="-3 -3 {bufferLength+10} {40+5}" width="400" height="100" class="graph" preserveAspectRatio="none">
		<path d="{spectrumComplexPhase.map((v,i) => `M${(i+bufferLength)%bufferLength+1},20 v${v/phaseMax*40}`).join('')}z" stroke="magenta" stroke-width="1" opacity="0.6" />
		<path  d="M0,0V40V20H{bufferLength+3}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
	</svg>
<h2>
	FFT Cepstrum
</h2>
	<svg viewBox="-3 -3 {bufferLength+10} {40+5}" width="400" height="100" class="graph" preserveAspectRatio="none">
		<path d="{cepstrumComplex.map((v,i) => `M${(i+bufferLength)%bufferLength+1},20 v${-v/cepstrumComplexMax*40}`).join('')}z" stroke="orange" stroke-width="1" opacity="0.6" />
		<path  d="M0,0V40V20H{bufferLength+3}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
	</svg>
	
	
	{:else}
	
	<h2>
	FFT Magnitude Spectra
</h2>
	<svg viewBox="-3 -3 {bufferLength+10} {40+5}" width="400" height="100" class="graph" preserveAspectRatio="none">
		<path  d="{spectrumXMag.map((v,i) => `M${(i+bufferLength)%bufferLength+1},40 v${-v/spectrumMax*40}`).join('')}z" stroke="#8f0" stroke-width="1" opacity="0.6" />
		<path  d="{spectrumYMag.map((v,i) => `M${(i+bufferLength)%bufferLength+1},40 v${-v/spectrumMax*40}`).join('')}z" stroke="#f08" stroke-width="1" opacity="0.6" />
		<path  d="M0,0V40H{bufferLength+3}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
	</svg>
	<h2>
	FFT Phase Spectra
</h2>
	<svg viewBox="-3 -3 {bufferLength+10} {40+5}" width="400" height="100" class="graph" preserveAspectRatio="none">
		<path d="{spectrumXPhase.map((v,i) => `M${(i+bufferLength)%bufferLength+1},20 v${-v/phaseMax*40}`).join('')}z" stroke="#8f0" stroke-width="1" opacity="0.6" />
		<path d="{spectrumYPhase.map((v,i) => `M${(i+bufferLength)%bufferLength+1},20 v${-v/phaseMax*40}`).join('')}z" stroke="#f08" stroke-width="1" opacity="0.6" />
		<path  d="M0,0V40V20H{bufferLength+3}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
	</svg>
<h2>
	FFT Cepstra
</h2>
	<svg viewBox="-3 -3 {bufferLength+10} {40+5}" width="400" height="100" class="graph" preserveAspectRatio="none">
		<path d="{cepstrumX.map((v,i) => `M${(i+bufferLength)%bufferLength+1},20 v${-v/cepstrumXYMax*40}`).join('')}z" stroke="#8f0" stroke-width="1" opacity="0.6" />
		<path d="{cepstrumY.map((v,i) => `M${(i+bufferLength)%bufferLength+1},20 v${-v/cepstrumXYMax*40}`).join('')}z" stroke="#f08" stroke-width="1" opacity="0.6" />
		<path  d="M0,0V40V20H{bufferLength+3}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
	</svg>
	
	
	{/if}


	
	<h2>
		Filter Coefficients
	</h2>
	
	<div class="grid">
		<div class="grid-head">
			Auto-Regressive (a):
		</div>
		{#each filter.a as v,i}
		<input type="number" size="3" step="0.01" min="-2" max="2" bind:value={filter.a[i]} />
		{/each}
		
		<div class="grid-head">
			Moving-Average (b):
		</div>
		{#each filter.b as v,i}
		<input type="number" size="3" step="0.01" min="-2" max="2" bind:value={filter.b[i]} />
		{/each}
	</div>
	

	<h2>
		Filtered Output
	</h2>
	

	{#if complex}
	<svg viewBox="-3 -3 {bufferLength+10} {40+5}" width="400" height="200" class="graph" preserveAspectRatio="none">
		<path  d="{outputComplexMag.map((v,i) => `M${((follow?-index:0)+i+bufferLength)%bufferLength+1},20 v${-v/bufferMagMax*40}`).join('')}z" stroke="red" stroke-width="1" opacity="0.6" />
		<path  d="{outputComplexPhase.map((v,i) => `M${((follow?-index:0)+i+bufferLength)%bufferLength+1},20 v${v/phaseMax*40}`).join('')}z" stroke="orange" stroke-width="1" opacity="0.6" />
		
		<path  d="M0,0V40V20H{bufferLength+3}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
		<path d="M{(!follow?index:bufferLength)},0v40" stroke="yellow" stroke-width="1" vector-effect="non-scaling-stroke"  />

	</svg>
	{:else}
	<svg viewBox="-3 -3 {bufferLength+10} {40+5}" width="400" height="200" class="graph" preserveAspectRatio="none">
		<path  d="{outputX.map((v,i) => `M${((follow?-index:0)+i+bufferLength)%bufferLength+1},20 v${-v/bufferXMax*40}`).join('')}z" stroke="red" stroke-width="1" opacity="0.6" />
		<path  d="{outputY.map((v,i) => `M${((follow?-index:0)+i+bufferLength)%bufferLength+1},20 v${v/bufferYMax*40}`).join('')}z" stroke="orange" stroke-width="1" opacity="0.6" />
		
		<path  d="M0,0V40V20H{bufferLength+3}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
		<path d="M{(!follow?index:bufferLength)},0v40" stroke="yellow" stroke-width="1" vector-effect="non-scaling-stroke"  />

	</svg>
	
	{/if}

	<footer>
		<a href="https://tools.laszlokorte.de">More educational tools</a>
	</footer>
</div>

</div>