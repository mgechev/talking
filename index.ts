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

export interface ActivityCallback {
  (confidence: number): void;
}

export interface ReadyCallback {
  (): void;
}

export class Talking {
  private audioContext: AudioContext;
  private analyzerNode: AnalyserNode;
  private samplingTimeout;
  private workerTimeout;
  private callbacks: ActivityCallback[] = [];
  private readyCallbacks: ReadyCallback[] = [];

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
    this.audioContext.close();
    this.analyzerNode.disconnect();
    this.callbacks = [];
    this.readyCallbacks = [];
  }

  onActivity(cb: ActivityCallback) {
    this.callbacks.push(cb);
  }

  onReady(cb: ReadyCallback) {
    this.readyCallbacks.push(cb);
  }

  private startSampling() {
    let minVals: number[] = [];
    let maxVals: number[] = [];
    let minVal = Infinity;
    let maxVal = -Infinity;
    let maxAvg = 0;
    let maxStDev = 0;
    let minAvg = 0;
    let minStDev = 0;
    let statisticsReady = false;
    this.samplingTimeout = setTimeout(() => {
      statisticsReady = true;
      maxAvg = avg(maxVals);
      minAvg = avg(minVals);
      maxStDev = stdev(maxVals);
      minStDev = stdev(minVals);
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
      minVals.push(minVal);
      maxVals.push(maxVal);
      if (statisticsReady) {
        maxVal = maxAvg;
        minVal = minAvg;
        if (!(sum > maxAvg + maxStDev || sum < maxAvg - maxStDev)) {
          maxVal = Math.max(maxVal, sum);
        }
        if (minVal !== maxVal) {
          const diff = maxVal - minVal;
          const threshold = minVal + diff * 2 / 3;
          if (sum >= threshold) {
            const confidence = Math.min(1, threshold / sum);
            this.callbacks.forEach(c => c(confidence));
          } else {
            this.callbacks.forEach(c => c(0));
          }
        }
      }
      this.workerTimeout = setTimeout(() => samplingFn(), 10);
    };

    samplingFn();
  }
}
