/**
 * Leitor de Pressão Arterial Acessível
 * Aplicação para leitura de medidores de pressão usando câmera e OCR
 * Desenvolvido com foco em acessibilidade para pessoas cegas
 */

// ===== Classe Principal =====
class BloodPressureReader {
    constructor() {
        // Elementos DOM
        this.video = document.getElementById('camera-feed');
        this.captureCanvas = document.getElementById('capture-canvas');
        this.overlayCanvas = document.getElementById('overlay-canvas');
        this.guideBox = document.getElementById('guide-box');
        
        // Botões
        this.startCameraBtn = document.getElementById('start-camera-btn');
        this.captureBtn = document.getElementById('capture-btn');
        this.autoModeBtn = document.getElementById('auto-mode-btn');
        this.repeatBtn = document.getElementById('repeat-btn');
        
        // Elementos de status
        this.statusMessage = document.getElementById('status-message');
        this.orientationGuide = document.getElementById('orientation-guide');
        
        // Elementos de resultado
        this.systolicValue = document.getElementById('systolic-value');
        this.diastolicValue = document.getElementById('diastolic-value');
        this.pulseValue = document.getElementById('pulse-value');
        this.healthAssessment = document.getElementById('health-assessment');
        this.healthMessage = document.getElementById('health-message');
        
        // Estado da aplicação
        this.stream = null;
        this.isAutoMode = false;
        this.autoModeInterval = null;
        this.lastReading = null;
        this.isProcessing = false;
        this.tesseractWorker = null;
        this.orientationCheckInterval = null;
        this.lastOrientationSpoken = '';
        this.speechSynthesis = window.speechSynthesis;
        this.speechQueue = [];
        this.isSpeaking = false;
        
        // Configurações
        this.config = {
            autoModeDelay: 3000,
            orientationCheckDelay: 1500,
            minConfidence: 60,
            speechRate: 1.0,
            speechPitch: 1.0,
            speechVolume: 1.0,
            language: 'pt-BR'
        };
        
        // Inicializar
        this.init();
    }
    
    // ===== Inicialização =====
    async init() {
        this.bindEvents();
        this.setupKeyboardShortcuts();
        await this.initTesseract();
        this.speak('Aplicativo de leitura de pressão arterial carregado. Pressione o botão Iniciar Câmera para começar.');
    }
    
    bindEvents() {
        this.startCameraBtn.addEventListener('click', () => this.toggleCamera());
        this.captureBtn.addEventListener('click', () => this.captureAndRead());
        this.autoModeBtn.addEventListener('click', () => this.toggleAutoMode());
        this.repeatBtn.addEventListener('click', () => this.repeatLastReading());
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignorar se estiver em um campo de input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key.toLowerCase()) {
                case 'c':
                    e.preventDefault();
                    this.toggleCamera();
                    break;
                case 'l':
                    e.preventDefault();
                    if (!this.captureBtn.disabled) this.captureAndRead();
                    break;
                case 'r':
                    e.preventDefault();
                    if (!this.repeatBtn.disabled) this.repeatLastReading();
                    break;
                case 'a':
                    e.preventDefault();
                    if (!this.autoModeBtn.disabled) this.toggleAutoMode();
                    break;
            }
        });
    }
    
    // ===== Síntese de Voz =====
    speak(text, priority = false) {
        if (priority) {
            // Cancelar fala atual e limpar fila
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
        
        utterance.lang = this.config.language;
        utterance.rate = this.config.speechRate;
        utterance.pitch = this.config.speechPitch;
        utterance.volume = this.config.speechVolume;
        
        // Tentar usar voz em português
        const voices = this.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang.startsWith('pt'));
        if (ptVoice) utterance.voice = ptVoice;
        
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
    
    // ===== Inicialização do Tesseract =====
    async initTesseract() {
        try {
            this.updateStatus('Carregando sistema de leitura...', 'processing');
            
            this.tesseractWorker = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        this.updateStatus(`Processando imagem: ${progress}%`, 'processing');
                    }
                }
            });
            
            // Configurar para reconhecer apenas dígitos
            await this.tesseractWorker.setParameters({
                tessedit_char_whitelist: '0123456789',
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK
            });
            
            this.updateStatus('Sistema pronto. Pressione Iniciar Câmera.', 'success');
            
        } catch (error) {
            console.error('Erro ao inicializar Tesseract:', error);
            this.updateStatus('Erro ao carregar sistema de leitura', 'error');
            this.speak('Erro ao carregar o sistema de leitura. Por favor, recarregue a página.');
        }
    }
    
    // ===== Controle da Câmera =====
    async toggleCamera() {
        if (this.stream) {
            this.stopCamera();
        } else {
            await this.startCamera();
        }
    }
    
    async startCamera() {
        try {
            this.updateStatus('Iniciando câmera...', 'processing');
            this.speak('Iniciando câmera. Aguarde.');
            
            // Configurações da câmera - preferir câmera traseira
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });
            
            // Configurar canvas
            this.captureCanvas.width = this.video.videoWidth;
            this.captureCanvas.height = this.video.videoHeight;
            this.overlayCanvas.width = this.video.videoWidth;
            this.overlayCanvas.height = this.video.videoHeight;
            
            // Atualizar UI
            this.startCameraBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">⏹️</span>Parar Câmera';
            this.captureBtn.disabled = false;
            this.autoModeBtn.disabled = false;
            
            this.updateStatus('Câmera ativa. Aponte para o medidor de pressão.', 'success');
            this.speak('Câmera iniciada. Aponte o celular para o display do medidor de pressão. Vou orientar você sobre o posicionamento.');
            
            // Iniciar verificação de orientação
            this.startOrientationCheck();
            
        } catch (error) {
            console.error('Erro ao acessar câmera:', error);
            this.updateStatus('Erro ao acessar câmera. Verifique as permissões.', 'error');
            this.speak('Não foi possível acessar a câmera. Por favor, verifique se você concedeu permissão de acesso à câmera.');
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.video.srcObject = null;
        this.stopOrientationCheck();
        this.stopAutoMode();
        
        // Atualizar UI
        this.startCameraBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">📷</span>Iniciar Câmera';
        this.captureBtn.disabled = true;
        this.autoModeBtn.disabled = true;
        
        this.updateStatus('Câmera desativada.', '');
        this.updateOrientation('Câmera desativada');
        this.speak('Câmera desativada.');
    }
    
    // ===== Verificação de Orientação =====
    startOrientationCheck() {
        this.orientationCheckInterval = setInterval(() => {
            this.checkOrientation();
        }, this.config.orientationCheckDelay);
    }
    
    stopOrientationCheck() {
        if (this.orientationCheckInterval) {
            clearInterval(this.orientationCheckInterval);
            this.orientationCheckInterval = null;
        }
    }
    
    async checkOrientation() {
        if (this.isProcessing || !this.stream) return;
        
        const ctx = this.captureCanvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0);
        
        // Analisar a imagem para determinar orientação
        const imageData = ctx.getImageData(0, 0, this.captureCanvas.width, this.captureCanvas.height);
        const analysis = this.analyzeImageForOrientation(imageData);
        
        let orientationMessage = '';
        let isAligned = false;
        
        if (analysis.hasDisplay) {
            if (analysis.centerOffsetX > 15) {
                orientationMessage = 'Mova para a direita';
            } else if (analysis.centerOffsetX < -15) {
                orientationMessage = 'Mova para a esquerda';
            } else if (analysis.centerOffsetY > 15) {
                orientationMessage = 'Mova para baixo';
            } else if (analysis.centerOffsetY < -15) {
                orientationMessage = 'Mova para cima';
            } else if (analysis.size < 20) {
                orientationMessage = 'Aproxime o celular';
            } else if (analysis.size > 60) {
                orientationMessage = 'Afaste o celular';
            } else {
                orientationMessage = 'Posição correta! Pressione Ler Pressão.';
                isAligned = true;
            }
        } else {
            orientationMessage = 'Display não detectado. Aponte para o medidor.';
        }
        
        // Atualizar UI
        this.updateOrientation(orientationMessage, isAligned);
        
        // Falar orientação apenas se mudou
        if (orientationMessage !== this.lastOrientationSpoken) {
            this.lastOrientationSpoken = orientationMessage;
            this.speak(orientationMessage, true);
        }
        
        // Atualizar guide box
        if (isAligned) {
            this.guideBox.classList.add('aligned');
        } else {
            this.guideBox.classList.remove('aligned');
        }
    }
    
    analyzeImageForOrientation(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        
        // Detectar áreas claras (display LCD geralmente é mais claro)
        let brightPixels = [];
        
        for (let y = 0; y < height; y += 10) {
            for (let x = 0; x < width; x += 10) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Detectar pixels claros (display)
                const brightness = (r + g + b) / 3;
                if (brightness > 180) {
                    brightPixels.push({ x, y });
                }
            }
        }
        
        if (brightPixels.length < 10) {
            return { hasDisplay: false };
        }
        
        // Calcular centro dos pixels claros
        let sumX = 0, sumY = 0;
        brightPixels.forEach(p => {
            sumX += p.x;
            sumY += p.y;
        });
        
        const centerX = sumX / brightPixels.length;
        const centerY = sumY / brightPixels.length;
        
        // Calcular offset do centro da imagem (em porcentagem)
        const centerOffsetX = ((centerX / width) - 0.5) * 100;
        const centerOffsetY = ((centerY / height) - 0.5) * 100;
        
        // Estimar tamanho do display
        const minX = Math.min(...brightPixels.map(p => p.x));
        const maxX = Math.max(...brightPixels.map(p => p.x));
        const size = ((maxX - minX) / width) * 100;
        
        return {
            hasDisplay: true,
            centerOffsetX,
            centerOffsetY,
            size
        };
    }
    
    // ===== Captura e Leitura =====
    async captureAndRead() {
        if (this.isProcessing || !this.stream) return;
        
        this.isProcessing = true;
        this.captureBtn.disabled = true;
        this.captureBtn.classList.add('loading');
        
        this.updateStatus('Capturando imagem...', 'processing');
        this.speak('Capturando imagem. Aguarde.', true);
        
        try {
            // Capturar frame
            const ctx = this.captureCanvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0);
            
            // Pré-processar imagem para melhor OCR
            this.preprocessImage(ctx);
            
            // Converter para blob
            const blob = await new Promise(resolve => {
                this.captureCanvas.toBlob(resolve, 'image/png');
            });
            
            // Executar OCR
            this.updateStatus('Processando leitura...', 'processing');
            
            const result = await this.tesseractWorker.recognize(blob);
            
            // Extrair valores
            const values = this.extractBloodPressureValues(result.data.text);
            
            if (values) {
                this.displayResults(values);
                this.lastReading = values;
                this.repeatBtn.disabled = false;
                
                const assessment = this.assessBloodPressure(values.systolic, values.diastolic);
                this.speakResults(values, assessment);
                
                this.updateStatus('Leitura concluída com sucesso!', 'success');
            } else {
                this.updateStatus('Não foi possível ler os valores. Tente novamente.', 'error');
                this.speak('Não foi possível ler os valores do display. Por favor, ajuste a posição do celular e tente novamente.');
            }
            
        } catch (error) {
            console.error('Erro na leitura:', error);
            this.updateStatus('Erro ao processar imagem.', 'error');
            this.speak('Ocorreu um erro ao processar a imagem. Por favor, tente novamente.');
        } finally {
            this.isProcessing = false;
            this.captureBtn.disabled = false;
            this.captureBtn.classList.remove('loading');
        }
    }
    
    preprocessImage(ctx) {
        const imageData = ctx.getImageData(0, 0, this.captureCanvas.width, this.captureCanvas.height);
        const data = imageData.data;
        
        // Aumentar contraste e converter para escala de cinza
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            
            // Binarização com limiar adaptativo
            const threshold = 128;
            const newValue = avg > threshold ? 255 : 0;
            
            // Inverter (texto escuro em fundo claro para melhor OCR)
            const finalValue = 255 - newValue;
            
            data[i] = finalValue;
            data[i + 1] = finalValue;
            data[i + 2] = finalValue;
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    extractBloodPressureValues(text) {
        console.log('Texto OCR:', text);
        
        // Limpar texto
        const cleanText = text.replace(/\s+/g, ' ').trim();
        
        // Encontrar todos os números de 2-3 dígitos
        const numbers = cleanText.match(/\d{2,3}/g);
        
        if (!numbers || numbers.length < 2) {
            return null;
        }
        
        // Converter para números
        const numericValues = numbers.map(n => parseInt(n, 10));
        
        // Filtrar valores válidos
        const validValues = numericValues.filter(n => n >= 30 && n <= 250);
        
        if (validValues.length < 2) {
            return null;
        }
        
        // Ordenar para encontrar sistólica, diastólica e pulso
        // Sistólica é geralmente o maior valor (exceto se houver pulso alto)
        // Diastólica é menor que sistólica
        // Pulso geralmente está entre 40-200
        
        let systolic, diastolic, pulse = null;
        
        // Estratégia: assumir que os dois maiores valores são pressão
        // e o terceiro (se existir e for razoável) é o pulso
        const sorted = [...validValues].sort((a, b) => b - a);
        
        // Primeiro, tentar identificar pela faixa típica
        const highValues = sorted.filter(v => v >= 60 && v <= 200);
        const pulseCandidate = sorted.find(v => v >= 40 && v <= 150);
        
        if (highValues.length >= 2) {
            systolic = highValues[0];
            diastolic = highValues[1];
            
            // Se há um terceiro valor que parece ser pulso
            if (sorted.length >= 3) {
                const remaining = sorted.find(v => v !== systolic && v !== diastolic && v >= 40 && v <= 150);
                if (remaining) pulse = remaining;
            }
        } else if (sorted.length >= 2) {
            systolic = sorted[0];
            diastolic = sorted[1];
        } else {
            return null;
        }
        
        // Validar: sistólica deve ser maior que diastólica
        if (systolic <= diastolic) {
            [systolic, diastolic] = [diastolic, systolic];
        }
        
        // Validação básica
        if (systolic < 70 || systolic > 250 || diastolic < 40 || diastolic > 150) {
            return null;
        }
        
        return { systolic, diastolic, pulse };
    }
    
    // ===== Exibição de Resultados =====
    displayResults(values) {
        const assessment = this.assessBloodPressure(values.systolic, values.diastolic);
        
        // Atualizar valores
        this.systolicValue.textContent = values.systolic;
        this.diastolicValue.textContent = values.diastolic;
        this.pulseValue.textContent = values.pulse || '---';
        
        // Aplicar classes de cor
        const systolicCard = this.systolicValue.closest('.result-card');
        const diastolicCard = this.diastolicValue.closest('.result-card');
        
        systolicCard.className = 'result-card ' + assessment.systolicClass;
        diastolicCard.className = 'result-card ' + assessment.diastolicClass;
        
        // Atualizar avaliação
        this.healthAssessment.className = 'health-box ' + assessment.overallClass;
        this.healthMessage.textContent = assessment.message;
    }
    
    assessBloodPressure(systolic, diastolic) {
        let systolicClass, diastolicClass, overallClass, message;
        
        // Classificação da sistólica
        if (systolic < 120) {
            systolicClass = 'normal';
        } else if (systolic < 130) {
            systolicClass = 'elevated';
        } else {
            systolicClass = 'high';
        }
        
        // Classificação da diastólica
        if (diastolic < 80) {
            diastolicClass = 'normal';
        } else if (diastolic < 90) {
            diastolicClass = 'elevated';
        } else {
            diastolicClass = 'high';
        }
        
        // Avaliação geral (baseada nas diretrizes de pressão arterial)
        if (systolic < 120 && diastolic < 80) {
            overallClass = 'normal';
            message = 'Pressão arterial normal';
        } else if (systolic >= 120 && systolic < 130 && diastolic < 80) {
            overallClass = 'elevated';
            message = 'Pressão arterial elevada';
        } else if ((systolic >= 130 && systolic < 140) || (diastolic >= 80 && diastolic < 90)) {
            overallClass = 'elevated';
            message = 'Hipertensão estágio 1 - Consulte um médico';
        } else if (systolic >= 140 || diastolic >= 90) {
            overallClass = 'high';
            message = 'Hipertensão estágio 2 - Procure atendimento médico';
        } else if (systolic > 180 || diastolic > 120) {
            overallClass = 'high';
            message = 'CRISE HIPERTENSIVA - Procure atendimento de emergência!';
        }
        
        return { systolicClass, diastolicClass, overallClass, message };
    }
    
    speakResults(values, assessment) {
        let speech = `Leitura concluída. `;
        speech += `Pressão sistólica, ou máxima: ${values.systolic} milímetros de mercúrio. `;
        speech += `Pressão diastólica, ou mínima: ${values.diastolic} milímetros de mercúrio. `;
        
        if (values.pulse) {
            speech += `Pulso: ${values.pulse} batimentos por minuto. `;
        }
        
        speech += `Avaliação: ${assessment.message}`;
        
        this.speak(speech);
    }
    
    repeatLastReading() {
        if (this.lastReading) {
            const assessment = this.assessBloodPressure(this.lastReading.systolic, this.lastReading.diastolic);
            this.speakResults(this.lastReading, assessment);
        }
    }
    
    // ===== Modo Automático =====
    toggleAutoMode() {
        if (this.isAutoMode) {
            this.stopAutoMode();
        } else {
            this.startAutoMode();
        }
    }
    
    startAutoMode() {
        this.isAutoMode = true;
        this.autoModeBtn.setAttribute('aria-pressed', 'true');
        this.autoModeBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">⏹️</span>Parar Automático';
        
        this.speak('Modo automático ativado. O aplicativo tentará ler automaticamente quando o display estiver bem posicionado.');
        
        this.autoModeInterval = setInterval(() => {
            if (!this.isProcessing && this.guideBox.classList.contains('aligned')) {
                this.captureAndRead();
            }
        }, this.config.autoModeDelay);
    }
    
    stopAutoMode() {
        this.isAutoMode = false;
        this.autoModeBtn.setAttribute('aria-pressed', 'false');
        this.autoModeBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">🔄</span>Modo Automático';
        
        if (this.autoModeInterval) {
            clearInterval(this.autoModeInterval);
            this.autoModeInterval = null;
        }
        
        this.speak('Modo automático desativado.');
    }
    
    // ===== Atualização de UI =====
    updateStatus(message, type = '') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = 'status-box ' + type;
    }
    
    updateOrientation(message, isAligned = false) {
        this.orientationGuide.textContent = message;
        this.orientationGuide.className = 'orientation-box ' + (isAligned ? 'aligned' : 'adjusting');
    }
}

// ===== Inicialização =====
document.addEventListener('DOMContentLoaded', () => {
    // Verificar suporte a recursos necessários
    const checkSupport = () => {
        const issues = [];
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            issues.push('Acesso à câmera não suportado');
        }
        
        if (!window.speechSynthesis) {
            issues.push('Síntese de voz não suportada');
        }
        
        if (!window.Tesseract) {
            issues.push('Biblioteca de OCR não carregada');
        }
        
        return issues;
    };
    
    const issues = checkSupport();
    
    if (issues.length > 0) {
        const statusMessage = document.getElementById('status-message');
        statusMessage.textContent = 'Erros: ' + issues.join(', ');
        statusMessage.className = 'status-box error';
        
        // Ainda assim tentar inicializar para dar feedback de voz se possível
    }
    
    // Carregar vozes
    if (window.speechSynthesis) {
        speechSynthesis.getVoices();
        speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
    }
    
    // Iniciar aplicação
    window.bloodPressureReader = new BloodPressureReader();
});

// ===== Service Worker para PWA (opcional) =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // Service worker não é crítico
        });
    });
}
