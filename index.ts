const avg = (n: number[]) => {
  let sum = 0;
  for (let i = 0; i < n.length; i += 1) {
    sum += n[i];
  }
  return sum / n.length;
};

const stdev = (n: number[]) => {
  const average = avg(n);
  let sum = 0;
  for (let i = 0; i < n.length; i += 1) {
    sum += Math.pow(n[i] - average, 2);
  }
  return Math.sqrt(sum / n.length);
};

export interface Callback {
  (): void;
}

export class Talking {
  private audioContext: AudioContext;
  private analyzerNode: AnalyserNode;
  private samplingTimeout;
  private workerTimeout;
  private inactiveTimeout;
  private callbacks: Callback[] = [];
  private inactiveCallbacks: Callback[] = [];
  private readyCallbacks: Callback[] = [];
  private isActive = false;

  constructor(private stream: MediaStream) {
    this.audioContext = new AudioContext();
    this.analyzerNode = this.audioContext.createAnalyser();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.analyzerNode);

    this.startSampling();
  }

  destroy() {
    clearTimeout(this.samplingTimeout);
    clearTimeout(this.workerTimeout);
    clearTimeout(this.inactiveTimeout);
    this.audioContext.close();
    this.analyzerNode.disconnect();
    this.callbacks = [];
    this.readyCallbacks = [];
  }

  onActive(cb: Callback) {
    this.callbacks.push(cb);
    return () => this.callbacks.splice(this.callbacks.indexOf(cb), 1);
  }

  onInactive(cb: Callback) {
    this.inactiveCallbacks.push(cb);
    return () =>
      this.inactiveCallbacks.splice(this.inactiveCallbacks.indexOf(cb), 1);
  }

  onReady(cb: Callback) {
    this.readyCallbacks.push(cb);
    return () => this.readyCallbacks.splice(this.readyCallbacks.indexOf(cb), 1);
  }

  get now() {
    return this.isActive;
  }

  private startSampling() {
    let minVals: number[] = [];
    let maxVals: number[] = [];
    let minVal = Infinity;
    let maxVal = -Infinity;
    let maxAvg = 0;
    let maxStDev = 0;
    let minAvg = 0;
    let statisticsReady = false;
    this.samplingTimeout = setTimeout(() => {
      statisticsReady = true;
      maxAvg = avg(maxVals);
      minAvg = avg(minVals);
      maxStDev = stdev(maxVals);
      minVals = [];
      maxVals = [];
      this.readyCallbacks.forEach(c => c());
    }, 10000);

    const samplingFn = () => {
      this.analyzerNode.fftSize = 2048;
      const bufferLength = this.analyzerNode.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      this.analyzerNode.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i += 1) {
        sum += dataArray[i];
      }
      minVal = Math.min(minVal, sum);
      maxVal = Math.max(maxVal, sum);
      if (!statisticsReady) {
        minVals.push(minVal);
        maxVals.push(maxVal);
      } else {
        maxVal = maxAvg;
        minVal = minAvg;
        if (!(sum > maxAvg + maxStDev || sum < maxAvg - maxStDev)) {
          maxVal = Math.max(maxVal, sum);
        }
        const diff = maxVal - minVal;
        const threshold = minVal + diff * 2 / 3;
        if (sum >= threshold) {
          this.callbacks.forEach(c => c());
          this.isActive = true;
        } else {
          if (this.active && !this.inactiveTimeout) {
            this.inactiveTimeout = setTimeout(() => {
              this.inactiveCallbacks.forEach(c => c());
              this.isActive = false;
              this.inactiveTimeout = null;
            }, 300);
          }
        }
      }
      this.workerTimeout = setTimeout(() => samplingFn(), 10);
    };

    samplingFn();
  }
}
