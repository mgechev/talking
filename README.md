# Talking

Very simple Voice Activity Detector.

# How to use?

```ts
// Creates a new `Talking` instance.
const talking = new Talking(stream);

// Invoked when the adjustment is ready.
let unsubscribe = talking.onReady(() => console.log('Ready to detect!'));
// ...
unsubscribe();

// When sound is detected.
let unsubscribe = talking.onActive(() => console.log('Talking!'));
// ...
unsubscribe();

// When the sound level decreases.
let unsubscribe = talking.onInactive(() => console.log('Stopped talking.'));
// ...
unsubscribe();

// Gets the current status. If `true` they sound is detected, otherwise `false`.
talking.now;

// Destroys the instance.
talking.destroy();
```

# License

MIT

