function _fft(amplitudes) {
	let N = amplitudes.length

	if(N <= 1){
		return amplitudes
	}

	let hN = N / 2;

	let even = Array(hN).fill(null)
	let odd = Array(hN).fill(null)

	for(let i = 0; i < hN; ++i){
		even[i] = amplitudes[i*2]
		odd[i] = amplitudes[i*2+1]
	}

	even = _fft(even)
	odd = _fft(odd)

	let a = -2*Math.PI

	for(let k = 0; k < hN; ++k){
		let p = k/N;
		let t = [Math.cos(a*p), Math.sin(a*p)];

		let r = t[0] * odd[k][0] - t[1] * odd[k][1];
		t[1] = t[0] * odd[k][1] + t[1] * odd[k][0];
		t[0] = r;

		amplitudes[k] = [  even[k][0] + t[0],  even[k][1] + t[1]];
		amplitudes[k + hN] = [  even[k][0] - t[0],   even[k][1] - t[1]];
	}


	return amplitudes;
}

export function fftShift(values) {
	return values.map((_,i) => values[(i + values.length/2) % values.length])
}


function fftRemovePadding(factor, values) {
	const realLength = values.length / Math.pow(2,factor)
	return [
		...values.slice(0, realLength/2),
		...values.slice(-realLength/2)
	]
}

export function fft(amplitudes)
{
	let N = amplitudes.length;
	let iN = 1 / N;

	// Apply Fourier Transform
	amplitudes = _fft(amplitudes)

	for(let i = 0; i < N; ++i){
		amplitudes[i][0] *= Math.sqrt(iN/2)
		amplitudes[i][1] *= Math.sqrt(iN/2)
	}
	return amplitudes;
}

export function fftInverse(amplitudes)
{
	const N = amplitudes.length;
	const iN = 1 / N;

	// Conjugate if imaginary part is not 0
	for(let i = 0; i < N; ++i){
		amplitudes[i][1] = -amplitudes[i][1]
	}

	// Apply Fourier Transform
	amplitudes = _fft(amplitudes)

	for(let i = 0; i < N; ++i){
		//Conjugate again
		amplitudes[i][1] = -amplitudes[i][1]
		// Scale
		amplitudes[i][0] *= Math.sqrt(2*iN)
		amplitudes[i][1] *= Math.sqrt(2*iN)
	}
	return amplitudes;
}