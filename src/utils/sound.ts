export const playBeep = () => {
  const audio = new Audio('/assets/beep.mp3');
  audio.play().catch(error => console.error("Error playing beep sound:", error));
};