# Leitor de Pressão Arterial Acessível

Aplicativo web acessível para leitura de medidores de pressão arterial usando a câmera do celular. Desenvolvido especialmente para pessoas com deficiência visual.

## 🎯 Funcionalidades

- **Leitura por câmera**: Usa a câmera traseira do celular para capturar imagens do medidor de pressão
- **OCR inteligente**: Reconhece automaticamente os números do display usando Tesseract.js
- **Orientação por voz**: Guia o usuário sobre o posicionamento correto do celular
- **Leitura em voz alta**: Fala os valores de pressão sistólica, diastólica e pulso
- **Avaliação de saúde**: Informa se a pressão está normal, elevada ou alta
- **Modo automático**: Leitura contínua quando o display está bem posicionado
- **Totalmente acessível**: ARIA labels, navegação por teclado, alto contraste

## 🚀 Como Usar

### Passo a Passo

1. **Abra o aplicativo** no navegador do celular
2. **Pressione "Iniciar Câmera"** para ativar a câmera
3. **Aponte para o display** do medidor de pressão
4. **Siga as orientações de voz** sobre o posicionamento:
   - "Mova para a direita/esquerda/cima/baixo"
   - "Aproxime/Afaste o celular"
   - "Posição correta!"
5. **Pressione "Ler Pressão"** quando ouvir "Posição correta"
6. **Ouça os resultados** em voz alta

### Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| `C` | Iniciar/Parar câmera |
| `L` | Ler pressão |
| `R` | Repetir última leitura |
| `A` | Ativar/Desativar modo automático |
| `Tab` | Navegar entre elementos |
| `Enter/Espaço` | Ativar botão selecionado |

## 📱 Requisitos

- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Acesso à câmera do dispositivo
- Conexão com internet (para carregar biblioteca de OCR)

## 🛠️ Tecnologias Utilizadas

- **HTML5**: Estrutura semântica e acessível
- **CSS3**: Design responsivo com suporte a tema escuro e alto contraste
- **JavaScript ES6+**: Lógica da aplicação
- **Tesseract.js**: Biblioteca de OCR (Reconhecimento Ótico de Caracteres)
- **Web Speech API**: Síntese de voz para feedback auditivo
- **MediaDevices API**: Acesso à câmera do dispositivo

## 📂 Estrutura do Projeto

```
Display + TTS/
├── index.html      # Página principal
├── styles.css      # Estilos e acessibilidade
├── app.js          # Lógica da aplicação
├── manifest.json   # Configuração PWA
├── sw.js           # Service Worker
└── README.md       # Esta documentação
```

## 🖥️ Como Executar Localmente

### Opção 1: Servidor Python
```bash
cd "g:\Meu Drive\IFG - Câmpus Goiânia Oeste\GO LabMaker\Projetos\Display + TTS"
python -m http.server 8080
```
Acesse: http://localhost:8080

### Opção 2: Live Server (VS Code)
1. Instale a extensão "Live Server" no VS Code
2. Clique com botão direito em `index.html`
3. Selecione "Open with Live Server"

### Opção 3: Para testar no celular
1. Execute o servidor no computador
2. Encontre o IP do computador na rede local
3. Acesse `http://SEU_IP:8080` no celular
4. Ambos devem estar na mesma rede Wi-Fi

## ♿ Recursos de Acessibilidade

- **ARIA Live Regions**: Anúncios automáticos de mudanças
- **Roles semânticos**: Navegação clara para leitores de tela
- **Skip links**: Pular para conteúdo principal
- **Alto contraste**: Suporte a `prefers-contrast: high`
- **Movimento reduzido**: Suporte a `prefers-reduced-motion`
- **Tema escuro**: Suporte a `prefers-color-scheme: dark`
- **Foco visível**: Indicadores claros de foco
- **Textos descritivos**: Labels e descrições completas

## 📊 Referência de Pressão Arterial

| Classificação | Sistólica | Diastólica |
|--------------|-----------|------------|
| Normal | < 120 | < 80 |
| Elevada | 120-129 | < 80 |
| Hipertensão Estágio 1 | 130-139 | 80-89 |
| Hipertensão Estágio 2 | ≥ 140 | ≥ 90 |
| Crise Hipertensiva | > 180 | > 120 |

## 🔧 Solução de Problemas

### Câmera não funciona
- Verifique se permitiu acesso à câmera
- Use HTTPS ou localhost (requisito de segurança)
- Tente em outro navegador

### OCR não reconhece valores
- Melhore a iluminação do ambiente
- Mantenha o celular estável
- Certifique-se que o display está nítido na tela
- Evite reflexos no display do medidor

### Voz não funciona
- Verifique o volume do dispositivo
- Teste em outro navegador
- Alguns navegadores requerem interação do usuário primeiro

## 📝 Licença

Desenvolvido pelo IFG - Câmpus Goiânia Oeste - GO LabMaker

---

**Aviso**: Este aplicativo é uma ferramenta auxiliar e não substitui orientação médica profissional. Sempre consulte um profissional de saúde para interpretação dos resultados.
