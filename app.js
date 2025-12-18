// VERSAO 2.5.0 - Codigo recriado com codificacao UTF-8 correta
/**
 * Leitor de Pressão Arterial Acessível
 * Aplicação para leitura de medidores de pressão usando câmera e OCR
 * Desenvolvido com foco em acessibilidade para pessoas cegas
 */

class BloodPressureReader {
    constructor() {
        this.video = document.getElementById('camera-feed');
        this.canvas = document.getElementById('capture-canvas');
        this.overlay = document.getElementById('overlay-canvas');
        this.guideBox = document.getElementById('guide-box');
        this.resultsContainer = document.getElementById('results-container');
        this.orientationFeedback = document.getElementById('orientation-feedback');
        
        this.startCameraBtn = document.getElementById('start-camera-btn');
        this.captureBtn = document.getElementById('capture-btn');
        this.autoModeBtn = document.getElementById('auto-mode-btn');
        this.repeatBtn = document.getElementById('repeat-btn');
        
        this.stream = null;
        this.isAutoMode = false;
        this.autoModeInterval = null;
        this.lastReading = null;
        this.orientationCheckInterval = null;
        
        this.speechQueue = [];
        this.isSpeaking = false;
        this.speechSynthesis = window.speechSynthesis;
        this.selectedVoice = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.loadVoices();
        
        if (this.speechSynthesis.onvoiceschanged !== undefined) {
            this.speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }
        
        setTimeout(() => {
            this.speak('Aplicação pronta para uso. Pressione o botão iniciar câmera para começar.');
        }, 1000);
    }

    loadVoices() {
        const voices = this.speechSynthesis.getVoices();
        const portugueseVoices = voices.filter(voice => 
            voice.lang.startsWith('pt')
        );
        
        if (portugueseVoices.length > 0) {
            this.selectedVoice = portugueseVoices.find(v => v.lang === 'pt-BR') || portugueseVoices[0];
        } else if (voices.length > 0) {
            this.selectedVoice = voices[0];
        }
    }

    speak(text, priority = false) {
        if (priority) {
            this.speechSynthesis.cancel();
            this.speechQueue = [];
        }
        
        this.speechQueue.push(text);
        this.processNextSpeech();
    }

    processNextSpeech() {
        if (this.isSpeaking || this.speechQueue.length === 0) return;
        
        const text = this.speechQueue.shift();
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        
        utterance.lang = 'pt-BR';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        utterance.onstart = () => {
            this.isSpeaking = true;
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.processNextSpeech();
        };
        
        utterance.onerror = () => {
            this.isSpeaking = false;
            this.processNextSpeech();
        };
        
        this.speechSynthesis.speak(utterance);
    }

    setupEventListeners() {
        this.startCameraBtn.addEventListener('click', () => this.toggleCamera());
        this.captureBtn.addEventListener('click', () => this.captureAndRead());
        this.autoModeBtn.addEventListener('click', () => this.toggleAutoMode());
        this.repeatBtn.addEventListener('click', () => this.repeatLastReading());

        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    if (this.stream) {
                        this.captureAndRead();
                    } else {
                        this.toggleCamera();
                    }
                    break;
                case 'r':
                case 'R':
                    this.repeatLastReading();
                    break;
                case 'a':
                case 'A':
                    if (this.stream) this.toggleAutoMode();
                    break;
                case 'Escape':
                    if (this.isAutoMode) this.toggleAutoMode();
                    break;
            }
        });
    }

    async toggleCamera() {
        if (this.stream) {
            this.stopCamera();
        } else {
            await this.startCamera();
        }
    }

    async startCamera() {
        try {
            this.speak('Iniciando câmera...');
            
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = resolve;
            });
            
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.overlay.width = this.video.videoWidth;
            this.overlay.height = this.video.videoHeight;
            
            this.captureBtn.disabled = false;
            this.autoModeBtn.disabled = false;
            this.startCameraBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">⏹️</span> Parar Câmera';
            
            this.speak('Câmera iniciada. Posicione o medidor de pressão na área indicada. Pressione ler pressão quando estiver pronto.');
            
            this.startOrientationCheck();
            
        } catch (error) {
            console.error('Erro ao iniciar câmera:', error);
            this.speak('Erro ao acessar a câmera. Verifique as permissões do navegador.', true);
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.video.srcObject = null;
        this.captureBtn.disabled = true;
        this.autoModeBtn.disabled = true;
        this.startCameraBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">📷</span> Iniciar Câmera';
        
        if (this.isAutoMode) {
            this.toggleAutoMode();
        }
        
        this.stopOrientationCheck();
        this.speak('Câmera desligada.');
    }

    startOrientationCheck() {
        this.orientationCheckInterval = setInterval(() => {
            this.analyzeImageForOrientation();
        }, 3000);
    }

    stopOrientationCheck() {
        if (this.orientationCheckInterval) {
            clearInterval(this.orientationCheckInterval);
            this.orientationCheckInterval = null;
        }
    }

    analyzeImageForOrientation() {
        if (!this.stream) return;
        
        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        let brightPixels = 0;
        let totalPixels = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (brightness > 200) brightPixels++;
        }
        
        const brightRatio = brightPixels / totalPixels;
        
        if (brightRatio > 0.7) {
            this.updateOrientationFeedback('Muita luz. Tente reduzir o brilho ou mudar de posição.');
        } else if (brightRatio < 0.1) {
            this.updateOrientationFeedback('Pouca luz. Aproxime de uma fonte de luz.');
        }
    }

    updateOrientationFeedback(message) {
        this.orientationFeedback.textContent = message;
        this.speak(message);
    }

    async captureAndRead() {
        if (!this.stream) return;
        
        this.speak('Capturando imagem...', true);
        
        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0);
        
        const imageData = this.canvas.toDataURL('image/png');
        
        await this.performOCR(imageData);
    }

    async performOCR(imageData) {
        try {
            this.speak('Processando imagem. Aguarde...');
            
            this.resultsContainer.innerHTML = '<p class="processing">Processando...</p>';
            
            const result = await Tesseract.recognize(
                imageData,
                'eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            const progress = Math.round(m.progress * 100);
                            if (progress % 25 === 0) {
                                console.log(`Progresso: ${progress}%`);
                            }
                        }
                    }
                }
            );
            
            this.processOCRResult(result.data.text);
            
        } catch (error) {
            console.error('Erro no OCR:', error);
            this.speak('Erro ao processar imagem. Tente novamente.', true);
            this.resultsContainer.innerHTML = '<p class="error">Erro ao processar. Tente novamente.</p>';
        }
    }

    processOCRResult(text) {
        console.log('Texto reconhecido:', text);
        
        const numbers = text.match(/\d+/g);
        
        if (!numbers || numbers.length < 2) {
            this.speak('Não foi possível identificar os valores. Reposicione o medidor e tente novamente.', true);
            this.resultsContainer.innerHTML = '<p class="error">Valores não identificados. Tente novamente.</p>';
            return;
        }
        
        const validNumbers = numbers
            .map(n => parseInt(n))
            .filter(n => n >= 30 && n <= 250);
        
        if (validNumbers.length < 2) {
            this.speak('Valores fora do esperado. Reposicione o medidor e tente novamente.', true);
            this.resultsContainer.innerHTML = '<p class="error">Valores inválidos. Tente novamente.</p>';
            return;
        }
        
        validNumbers.sort((a, b) => b - a);
        
        const systolic = validNumbers[0];
        const diastolic = validNumbers[1];
        const pulse = validNumbers[2] || null;
        
        this.lastReading = { systolic, diastolic, pulse };
        this.displayAndAnnounceResults(systolic, diastolic, pulse);
    }

    displayAndAnnounceResults(systolic, diastolic, pulse) {
        const classification = this.classifyPressure(systolic, diastolic);
        
        let html = `
            <div class="reading-result">
                <div class="pressure-values">
                    <div class="value-group">
                        <span class="value-label">Sistólica (máxima)</span>
                        <span class="value-number">${systolic}</span>
                        <span class="value-unit">mmHg</span>
                    </div>
                    <div class="value-separator">x</div>
                    <div class="value-group">
                        <span class="value-label">Diastólica (mínima)</span>
                        <span class="value-number">${diastolic}</span>
                        <span class="value-unit">mmHg</span>
                    </div>
                </div>
        `;
        
        if (pulse) {
            html += `
                <div class="pulse-value">
                    <span class="value-label">Pulso</span>
                    <span class="value-number">${pulse}</span>
                    <span class="value-unit">bpm</span>
                </div>
            `;
        }
        
        html += `
                <div class="classification ${classification.class}">
                    <span class="classification-label">Classificação:</span>
                    <span class="classification-value">${classification.label}</span>
                </div>
            </div>
        `;
        
        this.resultsContainer.innerHTML = html;
        this.repeatBtn.disabled = false;
        
        let announcement = `Leitura concluída. Pressão ${systolic} por ${diastolic}. ${classification.label}.`;
        if (pulse) {
            announcement += ` Pulso: ${pulse} batimentos por minuto.`;
        }
        
        this.speak(announcement, true);
    }

    classifyPressure(systolic, diastolic) {
        if (systolic < 90 || diastolic < 60) {
            return { label: 'Pressão baixa. Considere consultar um médico.', class: 'low' };
        } else if (systolic < 120 && diastolic < 80) {
            return { label: 'Pressão normal. Ótimo!', class: 'normal' };
        } else if (systolic < 130 && diastolic < 80) {
            return { label: 'Pressão elevada. Atenção.', class: 'elevated' };
        } else if (systolic < 140 || diastolic < 90) {
            return { label: 'Hipertensão estágio 1. Consulte um médico.', class: 'high-1' };
        } else if (systolic < 180 || diastolic < 120) {
            return { label: 'Hipertensão estágio 2. Procure atendimento médico.', class: 'high-2' };
        } else {
            return { label: 'Crise hipertensiva! Procure atendimento de emergência imediatamente!', class: 'crisis' };
        }
    }

    toggleAutoMode() {
        this.isAutoMode = !this.isAutoMode;
        this.autoModeBtn.setAttribute('aria-pressed', this.isAutoMode);
        
        if (this.isAutoMode) {
            this.autoModeBtn.classList.add('active');
            this.autoModeBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">⏸️</span> Parar Automático';
            this.speak('Modo automático ativado. Leituras a cada 5 segundos.');
            
            this.autoModeInterval = setInterval(() => {
                this.captureAndRead();
            }, 5000);
        } else {
            this.autoModeBtn.classList.remove('active');
            this.autoModeBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">🔄</span> Modo Automático';
            
            if (this.autoModeInterval) {
                clearInterval(this.autoModeInterval);
                this.autoModeInterval = null;
            }
            
            this.speak('Modo automático desativado.');
        }
    }

    repeatLastReading() {
        if (!this.lastReading) {
            this.speak('Nenhuma leitura disponível para repetir.');
            return;
        }
        
        const { systolic, diastolic, pulse } = this.lastReading;
        const classification = this.classifyPressure(systolic, diastolic);
        
        let announcement = `Última leitura: Pressão ${systolic} por ${diastolic}. ${classification.label}.`;
        if (pulse) {
            announcement += ` Pulso: ${pulse} batimentos por minuto.`;
        }
        
        this.speak(announcement, true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BloodPressureReader();
});
