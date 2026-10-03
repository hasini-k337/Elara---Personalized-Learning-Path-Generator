export function speak(text) {
  if (!window.speechSynthesis) {
    alert("Speech not supported")
    return
  }

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)

  utterance.rate = 0.95
  utterance.pitch = 1

  window.speechSynthesis.speak(utterance)
}


export function stopSpeaking() {
  window.speechSynthesis.cancel()
}