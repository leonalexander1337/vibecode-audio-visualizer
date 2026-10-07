/// <reference path="./worklet-globals.d.ts" />
import { BandSplitter } from '../dsp/BandSplitter';

/** Runs on the audio thread: splits the input into bands and posts one HopFrame per hop. */
class BandEnergyProcessor extends AudioWorkletProcessor {
  private readonly splitter = new BandSplitter(sampleRate);

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (channel) this.splitter.process(channel, currentTime, (frame) => this.port.postMessage(frame));
    return true;
  }
}

registerProcessor('band-energy', BandEnergyProcessor);
