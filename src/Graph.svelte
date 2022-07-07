<script>
	export let data = []
	export let follow = false
	export let offset = 0

	$: width = Math.max(...Object.values(data).map((v) => v.samples.length))
</script>

<style>
	.graph {
		background: #0005;
		height: 4em;
		width: 100%;
		display: block;
	}
	
	svg {
		margin: 0;
	}
</style>

<svg viewBox="-3 -3 {width+10} 46" width="400" height="100" class="graph" preserveAspectRatio="none">

{#each data as {color, samples, min, max} (color)}
<path d="{samples.map((v,i) => `M${((follow?-offset:0)+i+width)%width+1},20 v${-v/(max-min)*40}`).join('')}z" stroke={color} stroke-width="1" opacity="0.6" />
{/each}

<path d="M0,40V0V20H{width+3}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />

<path d="M{(follow?width:offset)},0v40" stroke="yellow" stroke-width="1" vector-effect="non-scaling-stroke"  />
</svg>