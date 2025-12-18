/**
 * Leitor de Pressão Arterial Acessível
 * Aplicação para leitura de medidores de pressão usando câmera e OCR
 * Desenvolvido com foco em acessibilidade para pessoas cegas
 */

// ===== VERSÃO =====
const APP_VERSION = '2.3.0';
const APP_BUILD_DATE = '2025-12-18';

// ===== Classe Principal =====
class BloodPressureReader {
    constructor() {
        this.version = APP_VERSION;
        
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
        this.captureAttempts = 0;
        this.debugMode = true; // Ativar logs de debug
        
        // Configurações otimizadas
        this.config = {
            autoModeDelay: 4000,
            orientationCheckDelay: 2000,
            minConfidence: 40, // Reduzido para ser menos restritivo
            speechRate: 0.9,
            speechPitch: 1.0,
            speechVolume: 1.0,
            language: 'pt-BR',
            // Configurações de detecção mais permissivas
            brightnessThreshold: 150, // Reduzido de 180
            minBrightPixels: 5, // Reduzido de 10
            positionTolerance: 25, // Aumentado de 15
            minDisplaySize: 10, // Reduzido de 20
            maxDisplaySize: 80 // Aumentado de 60
        };
        
        // Inicializar
        this.init();
    }
    
    // ===== Inicialização =====
    async init() {
        // Exibir versão no console e na tela
        console.log(`🩺 Leitor de Pressão Arterial v${APP_VERSION} (${APP_BUILD_DATE})`);
        this.showVersion();
        
        this.bindEvents();
        this.setupKeyboardShortcuts();
        
        await this.initTesseract();
        
        // Falar após um pequeno delay para garantir que as vozes carregaram
        setTimeout(() => {
            this.speak('Aplicativo de leitura de pressão arterial carregado. Pressione o botão Iniciar Câmera para começar.');
        }, 1000);
    }
    
    showVersion() {
        // Adicionar versão no footer
        const footer = document.querySelector('footer p');
        if (footer) {
            footer.innerHTML += ` | <strong>Versão ${APP_VERSION}</strong>`;
        }
        
        // Adicionar badge de versão
        const header = document.querySelector('header');
        if (header) {
            const versionBadge = document.createElement('div');
            versionBadge.id = 'version-badge';
            versionBadge.style.cssText = 'background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; margin-top: 8px; display: inline-block;';
            versionBadge.textContent = `v${APP_VERSION}`;
            versionBadge.setAttribute('aria-label', `Versão ${APP_VERSION}`);
            header.appendChild(versionBadge);
        }
    }
    
    bindEvents() {
        this.startCameraBtn.addEventListener('click', () => this.toggleCamera());
        this.captureBtn.addEventListener('click', () => this.captureAndRead());
        this.autoModeBtn.addEventListener('click', () => this.toggleAutoMode());
        this.repeatBtn.addEventListener('click', () => this.repeatLastReading());
        
        // Botão de teste de voz (importante para móveis!)
        const testVoiceBtn = document.getElementById('test-voice-btn');
        if (testVoiceBtn) {
            testVoiceBtn.addEventListener('click', () => this.testVoice());
        }
    }
    
    testVoice() {
        console.log('[VOZ] Teste de voz acionado pelo usuário');
        this.speak('Teste de voz. Se você está ouvindo esta mensagem, a voz está funcionando corretamente. Versão ' + APP_VERSION);
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
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
    
    // ===== Síntese de Voz (ORIGINAL v1.0 - FUNCIONAVA) =====
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
    
    testVoice() {
        console.log('[VOZ] Teste de voz acionado pelo usuário');
        this.speak('Teste de voz. Se você está ouvindo esta mensagem, a voz está funcionando corretamente. Versão ' + APP_VERSION);
    }
    processNextSpeech() {
        // Mantido para compatibilidade mas não usado
    }
    
    // ===== Inicialização do Tesseract =====
    async initTesseract() {
        try {
            this.updateStatus('Carregando sistema de leitura...', 'processing');
            
            // Criar worker com configuração otimizada para displays de 7 segmentos
            this.tesseractWorker = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        this.updateStatus(`Processando imagem: ${progress}%`, 'processing');
                    }
                }
            });
            
            // Configurar para melhor reconhecimento de dígitos
            await this.tesseractWorker.setParameters({
                tessedit_char_whitelist: '0123456789',
                tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, // Melhor para texto esparso
                preserve_interword_spaces: '0'
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
            
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
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
            
            this.captureCanvas.width = this.video.videoWidth;
            this.captureCanvas.height = this.video.videoHeight;
            this.overlayCanvas.width = this.video.videoWidth;
            this.overlayCanvas.height = this.video.videoHeight;
            
            this.startCameraBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">⏹️</span>Parar Câmera';
            this.captureBtn.disabled = false;
            this.autoModeBtn.disabled = false;
            
            this.updateStatus('Câmera ativa. Aponte para o medidor e pressione Ler Pressão.', 'success');
            this.speak('Câmera iniciada. Aponte o celular para o display do medidor de pressão e pressione o botão Ler Pressão quando estiver pronto. O botão funciona mesmo que a posição não esteja perfeita.');
            
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
        
        this.startCameraBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">📷</span>Iniciar Câmera';
        this.captureBtn.disabled = true;
        this.autoModeBtn.disabled = true;
        
        this.updateStatus('Câmera desativada.', '');
        this.updateOrientation('Câmera desativada');
        this.speak('Câmera desativada.');
    }
    
    // ===== Verificação de Orientação (mais permissiva) =====
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
        
        const imageData = ctx.getImageData(0, 0, this.captureCanvas.width, this.captureCanvas.height);
        const analysis = this.analyzeImageForOrientation(imageData);
        
        let orientationMessage = '';
        let isAligned = false;
        
        // Análise mais permissiva
        if (analysis.hasDisplay) {
            const absX = Math.abs(analysis.centerOffsetX);
            const absY = Math.abs(analysis.centerOffsetY);
            
            if (absX <= this.config.positionTolerance && absY <= this.config.positionTolerance) {
                if (analysis.size < this.config.minDisplaySize) {
                    orientationMessage = 'Aproxime um pouco o celular';
                } else if (analysis.size > this.config.maxDisplaySize) {
                    orientationMessage = 'Afaste um pouco o celular';
                } else {
                    orientationMessage = 'Boa posição! Pressione Ler Pressão.';
                    isAligned = true;
                }
            } else {
                // Dar dicas de direção apenas se muito desalinhado
                if (analysis.centerOffsetX > this.config.positionTolerance) {
                    orientationMessage = 'Mova para a direita';
                } else if (analysis.centerOffsetX < -this.config.positionTolerance) {
                    orientationMessage = 'Mova para a esquerda';
                } else if (analysis.centerOffsetY > this.config.positionTolerance) {
                    orientationMessage = 'Mova para baixo';
                } else if (analysis.centerOffsetY < -this.config.positionTolerance) {
                    orientationMessage = 'Mova para cima';
                }
            }
        } else {
            orientationMessage = 'Procurando display... Aponte para o medidor.';
        }
        
        this.updateOrientation(orientationMessage, isAligned);
        
        // Falar menos frequentemente para não irritar
        if (orientationMessage !== this.lastOrientationSpoken && !this.isProcessing) {
            this.lastOrientationSpoken = orientationMessage;
            // Só falar se for uma mensagem importante
            if (isAligned || orientationMessage.includes('Procurando')) {
                this.speak(orientationMessage, true);
            }
        }
        
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
        
        let brightPixels = [];
        
        // Análise com threshold mais baixo
        for (let y = 0; y < height; y += 8) {
            for (let x = 0; x < width; x += 8) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const brightness = (r + g + b) / 3;
                if (brightness > this.config.brightnessThreshold) {
                    brightPixels.push({ x, y, brightness });
                }
            }
        }
        
        if (brightPixels.length < this.config.minBrightPixels) {
            return { hasDisplay: false };
        }
        
        let sumX = 0, sumY = 0;
        brightPixels.forEach(p => {
            sumX += p.x;
            sumY += p.y;
        });
        
        const centerX = sumX / brightPixels.length;
        const centerY = sumY / brightPixels.length;
        
        const centerOffsetX = ((centerX / width) - 0.5) * 100;
        const centerOffsetY = ((centerY / height) - 0.5) * 100;
        
        const minX = Math.min(...brightPixels.map(p => p.x));
        const maxX = Math.max(...brightPixels.map(p => p.x));
        const size = ((maxX - minX) / width) * 100;
        
        return {
            hasDisplay: true,
            centerOffsetX,
            centerOffsetY,
            size,
            brightPixelCount: brightPixels.length
        };
    }
    
    // ===== Captura e Leitura (MELHORADA) =====
    async captureAndRead() {
        if (this.isProcessing || !this.stream) return;
        
        this.isProcessing = true;
        this.captureBtn.disabled = true;
        this.captureBtn.classList.add('loading');
        this.captureAttempts++;
        
        this.updateStatus('Capturando imagem...', 'processing');
        this.speak('Processando. Mantenha o celular parado.', true);
        
        try {
            // Capturar múltiplos frames e usar o melhor
            const results = await this.captureMultipleFrames(3);
            
            if (results) {
                this.displayResults(results);
                this.lastReading = results;
                this.repeatBtn.disabled = false;
                
                const assessment = this.assessBloodPressure(results.systolic, results.diastolic);
                this.speakResults(results, assessment);
                
                this.updateStatus('Leitura concluída com sucesso!', 'success');
            } else {
                this.handleFailedReading();
            }
            
        } catch (error) {
            console.error('Erro na leitura:', error);
            this.updateStatus('Erro ao processar imagem.', 'error');
            this.speak('Ocorreu um erro. Tente novamente.');
        } finally {
            this.isProcessing = false;
            this.captureBtn.disabled = false;
            this.captureBtn.classList.remove('loading');
        }
    }
    
    async captureMultipleFrames(count) {
        const allValues = [];
        
        for (let i = 0; i < count; i++) {
            // Pequeno delay entre capturas
            if (i > 0) await this.delay(200);
            
            const ctx = this.captureCanvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0);
            
            // Tentar múltiplos métodos de pré-processamento
            const methods = [
                () => this.preprocessImageV2(ctx, 'contrast'),
                () => this.preprocessImageV2(ctx, 'threshold'),
                () => this.preprocessImageV2(ctx, 'adaptive')
            ];
            
            for (const method of methods) {
                // Restaurar imagem original
                ctx.drawImage(this.video, 0, 0);
                method();
                
                const blob = await new Promise(resolve => {
                    this.captureCanvas.toBlob(resolve, 'image/png');
                });
                
                try {
                    const result = await this.tesseractWorker.recognize(blob);
                    
                    if (this.debugMode) {
                        console.log(`Tentativa ${i+1}, Texto OCR:`, result.data.text);
                    }
                    
                    const values = this.extractBloodPressureValues(result.data.text);
                    if (values) {
                        allValues.push(values);
                    }
                } catch (e) {
                    console.error('Erro OCR:', e);
                }
            }
        }
        
        // Retornar o resultado mais frequente ou o primeiro válido
        if (allValues.length > 0) {
            return this.getMostCommonReading(allValues);
        }
        
        return null;
    }
    
    getMostCommonReading(readings) {
        if (readings.length === 1) return readings[0];
        
        // Agrupar por valores similares
        const groups = [];
        for (const reading of readings) {
            let found = false;
            for (const group of groups) {
                if (Math.abs(group[0].systolic - reading.systolic) <= 5 &&
                    Math.abs(group[0].diastolic - reading.diastolic) <= 5) {
                    group.push(reading);
                    found = true;
                    break;
                }
            }
            if (!found) {
                groups.push([reading]);
            }
        }
        
        // Retornar o grupo mais frequente
        groups.sort((a, b) => b.length - a.length);
        
        // Calcular média do grupo mais frequente
        const bestGroup = groups[0];
        const avgSystolic = Math.round(bestGroup.reduce((s, r) => s + r.systolic, 0) / bestGroup.length);
        const avgDiastolic = Math.round(bestGroup.reduce((s, r) => s + r.diastolic, 0) / bestGroup.length);
        const avgPulse = bestGroup[0].pulse ? 
            Math.round(bestGroup.filter(r => r.pulse).reduce((s, r) => s + r.pulse, 0) / bestGroup.filter(r => r.pulse).length) : 
            null;
        
        return { systolic: avgSystolic, diastolic: avgDiastolic, pulse: avgPulse };
    }
    
    handleFailedReading() {
        let message = '';
        
        if (this.captureAttempts <= 2) {
            message = 'Não consegui ler os valores. Tente aproximar mais o celular do display e mantenha-o bem iluminado.';
        } else if (this.captureAttempts <= 4) {
            message = 'Ainda não consegui ler. Tente inclinar um pouco o celular para evitar reflexos no display.';
        } else {
            message = 'Dificuldade na leitura. Certifique-se que o display está ligado e mostrando os números claramente.';
            this.captureAttempts = 0; // Reset
        }
        
        this.updateStatus('Não foi possível ler. Tente novamente.', 'error');
        this.speak(message);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ===== Pré-processamento de Imagem V2 (MELHORADO) =====
    preprocessImageV2(ctx, method = 'adaptive') {
        const canvas = this.captureCanvas;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        switch(method) {
            case 'contrast':
                this.applyContrastEnhancement(data);
                break;
            case 'threshold':
                this.applySimpleThreshold(data, 140);
                break;
            case 'adaptive':
                this.applyAdaptiveThreshold(data, canvas.width, canvas.height);
                break;
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    applyContrastEnhancement(data) {
        const factor = 2.0; // Fator de contraste
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Converter para escala de cinza
            let gray = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Aumentar contraste
            gray = ((gray - 128) * factor) + 128;
            gray = Math.max(0, Math.min(255, gray));
            
            // Binarizar
            const final = gray > 128 ? 255 : 0;
            
            data[i] = final;
            data[i + 1] = final;
            data[i + 2] = final;
        }
    }
    
    applySimpleThreshold(data, threshold) {
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const final = gray > threshold ? 255 : 0;
            
            data[i] = final;
            data[i + 1] = final;
            data[i + 2] = final;
        }
    }
    
    applyAdaptiveThreshold(data, width, height) {
        const blockSize = 15;
        const C = 10;
        
        // Converter para escala de cinza primeiro
        const gray = new Uint8Array(width * height);
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        
        // Aplicar threshold adaptativo simplificado
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                // Calcular média local
                let sum = 0, count = 0;
                for (let dy = -blockSize; dy <= blockSize; dy++) {
                    for (let dx = -blockSize; dx <= blockSize; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            sum += gray[ny * width + nx];
                            count++;
                        }
                    }
                }
                
                const mean = sum / count;
                const final = gray[idx] > (mean - C) ? 255 : 0;
                
                const i = idx * 4;
                data[i] = final;
                data[i + 1] = final;
                data[i + 2] = final;
            }
        }
    }
    
    // ===== Extração de Valores (MELHORADA) =====
    extractBloodPressureValues(text) {
        if (this.debugMode) {
            console.log('Texto OCR bruto:', text);
        }
        
        // Limpar texto - remover caracteres estranhos
        let cleanText = text.replace(/[^0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (this.debugMode) {
            console.log('Texto limpo:', cleanText);
        }
        
        // Encontrar todos os números
        const allNumbers = cleanText.match(/\d+/g);
        
        if (!allNumbers) {
            return null;
        }
        
        // Filtrar números válidos (2-3 dígitos para pressão, 2-3 para pulso)
        let numbers = allNumbers
            .map(n => parseInt(n, 10))
            .filter(n => n >= 30 && n <= 250);
        
        if (this.debugMode) {
            console.log('Números encontrados:', numbers);
        }
        
        if (numbers.length < 2) {
            // Tentar extrair de números maiores (ex: "12080" -> 120, 80)
            for (const numStr of allNumbers) {
                if (numStr.length >= 5) {
                    // Pode ser dois números juntos
                    const possibleSystolic = parseInt(numStr.substring(0, 3), 10);
                    const possibleDiastolic = parseInt(numStr.substring(3), 10);
                    
                    if (possibleSystolic >= 70 && possibleSystolic <= 200 &&
                        possibleDiastolic >= 40 && possibleDiastolic <= 130) {
                        numbers = [possibleSystolic, possibleDiastolic];
                        break;
                    }
                }
            }
        }
        
        if (numbers.length < 2) {
            return null;
        }
        
        // Ordenar do maior para menor
        numbers.sort((a, b) => b - a);
        
        // Identificar valores
        let systolic = null, diastolic = null, pulse = null;
        
        // Estratégia: valores típicos
        // Sistólica: 90-180 (mais comum 110-140)
        // Diastólica: 60-100 (mais comum 70-90)
        // Pulso: 50-120 (mais comum 60-100)
        
        const systolicCandidates = numbers.filter(n => n >= 90 && n <= 200);
        const diastolicCandidates = numbers.filter(n => n >= 50 && n <= 110);
        
        if (systolicCandidates.length > 0 && diastolicCandidates.length > 0) {
            systolic = systolicCandidates[0]; // Maior valor na faixa
            
            // Diastólica deve ser menor que sistólica
            diastolic = diastolicCandidates.find(d => d < systolic);
            
            if (!diastolic && diastolicCandidates.length > 0) {
                diastolic = diastolicCandidates[diastolicCandidates.length - 1];
            }
        }
        
        // Fallback: usar os dois maiores valores
        if (!systolic || !diastolic) {
            systolic = numbers[0];
            diastolic = numbers.length > 1 ? numbers[1] : null;
        }
        
        // Garantir que sistólica > diastólica
        if (systolic && diastolic && systolic < diastolic) {
            [systolic, diastolic] = [diastolic, systolic];
        }
        
        // Verificar se há um terceiro valor (pulso)
        if (numbers.length >= 3) {
            const pulseCandidates = numbers.filter(n => 
                n !== systolic && n !== diastolic && n >= 40 && n <= 150
            );
            if (pulseCandidates.length > 0) {
                pulse = pulseCandidates[0];
            }
        }
        
        // Validação final
        if (!systolic || !diastolic) {
            return null;
        }
        
        if (systolic < 70 || systolic > 220 || diastolic < 40 || diastolic > 140) {
            return null;
        }
        
        // A diferença deve ser razoável
        if (systolic - diastolic < 20 || systolic - diastolic > 100) {
            return null;
        }
        
        if (this.debugMode) {
            console.log('Valores extraídos:', { systolic, diastolic, pulse });
        }
        
        return { systolic, diastolic, pulse };
    }
    
    // ===== Exibição de Resultados =====
    displayResults(values) {
        const assessment = this.assessBloodPressure(values.systolic, values.diastolic);
        
        this.systolicValue.textContent = values.systolic;
        this.diastolicValue.textContent = values.diastolic;
        this.pulseValue.textContent = values.pulse || '---';
        
        const systolicCard = this.systolicValue.closest('.result-card');
        const diastolicCard = this.diastolicValue.closest('.result-card');
        
        systolicCard.className = 'result-card ' + assessment.systolicClass;
        diastolicCard.className = 'result-card ' + assessment.diastolicClass;
        
        this.healthAssessment.className = 'health-box ' + assessment.overallClass;
        this.healthMessage.textContent = assessment.message;
    }
    
    assessBloodPressure(systolic, diastolic) {
        let systolicClass, diastolicClass, overallClass, message;
        
        if (systolic < 120) systolicClass = 'normal';
        else if (systolic < 130) systolicClass = 'elevated';
        else systolicClass = 'high';
        
        if (diastolic < 80) diastolicClass = 'normal';
        else if (diastolic < 90) diastolicClass = 'elevated';
        else diastolicClass = 'high';
        
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
        }
        
        if (systolic > 180 || diastolic > 120) {
            overallClass = 'high';
            message = 'CRISE HIPERTENSIVA - Procure atendimento de emergência!';
        }
        
        return { systolicClass, diastolicClass, overallClass, message };
    }
    
    speakResults(values, assessment) {
        let speech = `Leitura concluída. `;
        speech += `Pressão máxima: ${values.systolic}. `;
        speech += `Pressão mínima: ${values.diastolic}. `;
        
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
        
        this.speak('Modo automático ativado.');
        
        this.autoModeInterval = setInterval(() => {
            if (!this.isProcessing) {
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
    }
    
    if (window.speechSynthesis) {
        speechSynthesis.getVoices();
        speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
    }
    
    window.bloodPressureReader = new BloodPressureReader();
});

// ===== Service Worker =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}
