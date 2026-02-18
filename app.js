const App = {
    user: null,
    prefs: null,
    currentBimestre: 'bimestre1',
    currentProva: 'avaliacao1',
    currentDisciplinaId: null,
    currentBNome: '1º Bimestre',
    currentPNome: 'Avaliação 1',
    currentRoute: 'dashboard',
    theme: localStorage.getItem('theme') || 'dark',
    progresso: [],
    deferredPrompt: null,

    async init() {
        this.applyTheme();

        // Carregar preferências globais
        try {
            const prefResp = await fetch('api.php?acao=obter_preferencias');
            const prefJson = await prefResp.json();
            this.prefs = prefJson.dados;

            const resp = await fetch('api.php?acao=verificar_sessao');
            const json = await resp.json();

            if (json.sucesso) {
                this.user = json.dados;

                // Carregar progresso inicial
                const progResp = await fetch('api.php?acao=obter_progresso');
                const progJson = await progResp.json();
                this.progresso = progJson.dados || [];

                this.renderNav();
                Router.go('dashboard');
            } else {
                Router.go('login');
            }
        } catch (e) {
            console.error('Erro na inicialização:', e);
            Router.go('login');
        }
    },

    verificarSenhaMestra(callback) {
        this.pendingCallback = callback;
        const modalHtml = `
            <div id="password-modal" class="modal-overlay page-fade-in" style="z-index: 3000">
                <div class="modal-password">
                    <i class="material-icons-round text-primary text-4xl mb-2">lock</i>
                    <h3>Acesso Restrito</h3>
                    <p class="text-xs text-dim mb-6">Confirme a senha para continuar</p>
                    <input type="password" id="input-master-pass" placeholder="••••" autofocus>
                    <div class="btn-group">
                        <button class="btn-primary" style="background: rgba(255,255,255,0.05); color: var(--app-text)" onclick="document.getElementById('password-modal').remove()">Cancelar</button>
                        <button class="btn-primary" onclick="App.validarESeguir()">Confirmar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('input-master-pass').focus();
    },

    validarESeguir() {
        const senha = document.getElementById('input-master-pass').value;
        if (senha === 'SuperMaster') {
            document.getElementById('password-modal').remove();
            if (this.pendingCallback) this.pendingCallback();
        } else {
            alert('❌ Senha incorreta!');
            document.getElementById('input-master-pass').value = '';
            document.getElementById('input-master-pass').focus();
        }
    },

    async toggleConclusao(mid) {
        const resp = await fetch('api.php?acao=toggle_material_concluido', {
            method: 'POST',
            body: JSON.stringify({ id: mid })
        });
        const json = await resp.json();
        if (json.sucesso) {
            this.progresso = json.dados;
            // Recarregar tela atual para refletir mudança
            if (this.currentRoute === 'materiais') {
                UI.renderMateriais({ disciplina_id: App.currentDisciplinaId, nome: document.querySelector('h1').innerText });
            } else if (this.currentRoute === 'disciplinas') {
                Router.go('disciplinas', { pNome: this.currentPNome, bNome: this.currentBNome });
            }
        }
    },

    compartilharAcessoAmigo(nome, usuario, senha) {
        const urlApp = "https://jrsys.com.br/yarastudies";
        const texto = `🎓 *Yara's Studies* - Convite de Estudo!\n\nOi! Aqui está seu acesso para estudar com a Yara:\n\nLink: ${urlApp}\nUsuário: ${usuario}\nSenha: ${senha}\n\nBons estudos! ✨`;

        if (navigator.share) {
            navigator.share({
                title: "Acesso Yara's Studies",
                text: texto,
                url: urlApp
            }).catch(console.error);
        } else {
            // Fallback robusto para cópia (funciona mesmo sem HTTPS)
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(texto).then(() => {
                    alert('✅ Link e acesso copiados!');
                }).catch(() => this.fallbackCopyTextToClipboard(texto));
            } else {
                this.fallbackCopyTextToClipboard(texto);
            }
        }
    },

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            alert('✅ Link e acesso copiados!');
        } catch (err) {
            alert('❌ Erro ao copiar. Por favor, tente manualmente.');
        }
        document.body.removeChild(textArea);
        document.body.removeChild(textArea);
    },

    async instalarApp() {
        if (!this.deferredPrompt) return;
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('Usuário aceitou a instalação');
            this.deferredPrompt = null;
            UI.renderLogin(); // Esconder botão
        }
    },

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
        this.renderNav();
    },

    applyTheme() {
        if (this.theme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    },

    renderNav() {
        const nav = document.getElementById('main-nav');
        if (!this.user) {
            nav.classList.add('hidden');
            return;
        }

        nav.classList.remove('hidden');
        const currentThemeIcon = this.theme === 'dark' ? 'light_mode' : 'dark_mode';

        let html = `
            ${this.currentRoute !== 'dashboard' ? `
                <a href="javascript:void(0)" class="nav-item" onclick="App.voltar()">
                    <i class="material-icons-round">arrow_back</i>
                    <span>Voltar</span>
                </a>
            ` : ''}
            <a href="javascript:void(0)" class="nav-item ${this.currentRoute === 'dashboard' ? 'active' : ''}" onclick="Router.go('dashboard')">
                <i class="material-icons-round">home</i>
                <span>Início</span>
            </a>
            <a href="javascript:void(0)" class="nav-item" onclick="App.toggleTheme()">
                <i class="material-icons-round">${currentThemeIcon}</i>
                <span>Tema</span>
            </a>
        `;

        if (this.user.tipo === 'Admin') {
            html += `
                <a href="javascript:void(0)" class="nav-item ${this.currentRoute === 'preferencias' ? 'active' : ''}" onclick="Router.go('preferencias')">
                    <i class="material-icons-round">settings</i>
                    <span>Ajustes</span>
                </a>
            `;
        }

        html += `
            <a href="javascript:void(0)" class="nav-item" onclick="App.logout()">
                <i class="material-icons-round">logout</i>
                <span>Sair</span>
            </a>
        `;
        nav.innerHTML = html;
    },

    async login(usuario, senha) {
        const resp = await fetch('api.php?acao=login', {
            method: 'POST',
            body: JSON.stringify({ usuario, senha })
        });
        const json = await resp.json();
        if (json.sucesso) {
            this.user = json.dados;
            this.renderNav();
            Router.go('dashboard');
        } else {
            alert(json.mensagem);
        }
    },

    async logout() {
        await fetch('api.php?acao=logout');
        this.user = null;
        document.getElementById('main-nav').classList.add('hidden');
        Router.go('login');
    },

    voltar() {
        if (this.currentRoute === 'materiais') {
            Router.go('disciplinas', { pNome: this.currentPNome, bNome: this.currentBNome });
        } else if (this.currentRoute === 'disciplinas') {
            Router.go('dashboard');
        } else if (this.currentRoute === 'preferencias') {
            Router.go('dashboard');
        } else {
            Router.go('dashboard');
        }
    }
};

const Router = {
    routes: {
        login: () => UI.renderLogin(),
        dashboard: () => UI.renderDashboard(),
        preferencias: () => UI.renderPreferencias(),
        disciplinas: (params) => UI.renderDisciplinas(params),
        materiais: (params) => UI.renderMateriais(params)
    },

    go(route, params = {}) {
        App.currentRoute = route;
        const render = this.routes[route];
        if (render) {
            render(params);
            window.scrollTo(0, 0);
            App.renderNav();
        }
    }
};

const UI = {
    app: document.getElementById('app'),

    renderLogin() {
        this.app.innerHTML = `
            <div class="page-fade-in flex flex-col items-center justify-center p-8 min-h-screen">
                <div class="mb-12 text-center">
                    <div class="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="material-icons-round text-primary" style="font-size: 3rem;">auto_stories</i>
                    </div>
                    <h1 class="text-3xl font-bold mb-2">Yara's Studies</h1>
                    <p class="text-dim">Pronta para sua próxima aventura, Yara?</p>
                </div>

                <div class="w-full max-w-sm">
                    <div class="input-group">
                        <label>Usuário</label>
                        <input type="text" id="login-user" class="input-field" placeholder="Seu nome de usuário...">
                    </div>
                    <div class="input-group">
                        <label>Senha</label>
                        <input type="password" id="login-pass" class="input-field" placeholder="••••••••">
                    </div>
                    <button class="btn-primary mt-4" onclick="App.login(document.getElementById('login-user').value, document.getElementById('login-pass').value)">
                        Entrar e Estudar
                        <i class="material-icons-round">arrow_forward</i>
                    </button>
                </div>
                
                <div class="mt-12 opacity-50 flex items-center gap-2">
                    <i class="material-icons-round">school</i>
                    <span class="text-sm">Colégio Brasil • ${App.prefs ? App.prefs.ano_vigente : '...'}</span>
                </div>

                ${App.deferredPrompt ? `
                    <button class="btn-primary mt-8" style="background: rgba(255,255,255,0.05); color: var(--app-text); border: 1px solid var(--app-border)" onclick="App.instalarApp()">
                        <i class="material-icons-round">add_to_home_screen</i>
                        Adicionar à Tela Inicial
                    </button>
                ` : ''}
            </div>
        `;
    },

    renderDashboard() {
        const bimestres = [
            { id: 'bimestre1', nome: '1º Bimestre', periodo: 'Fevereiro - Abril', cor: '#10B981' },
            { id: 'bimestre2', nome: '2º Bimestre', periodo: 'Maio - Junho', cor: '#3B82F6' },
            { id: 'bimestre3', nome: '3º Bimestre', periodo: 'Agosto - Setembro', cor: '#F59E0B' },
            { id: 'bimestre4', nome: '4º Bimestre', periodo: 'Outubro - Dezembro', cor: '#EF4444' }
        ];

        let html = `
            <div class="page-fade-in p-6">
                <header class="header-home">
                    <div class="header-top">
                        <div class="profile-badge">
                            <div class="avatar-mini">
                                <i class="material-icons-round">person</i>
                            </div>
                            <span class="text-xs font-bold uppercase tracking-wider truncate max-w-[120px]">Oi, ${App.user.nome}! 👋</span>
                        </div>
                        <div class="w-10 h-10 glass rounded-xl flex items-center justify-center opacity-40">
                             <i class="material-icons-round text-sm">notifications_none</i>
                        </div>
                    </div>

                    <div class="header-main-text">
                        <h1>Meus Estudos</h1>
                        <div class="year-badge">
                            <i class="material-icons-round text-xs">calendar_today</i>
                            Cronograma ${App.prefs.ano_vigente}
                        </div>
                    </div>
                </header>

                <div class="space-y-4">
        `;

        bimestres.forEach(b => {
            html += `
                <div class="card-bimestre glass" onclick="UI.toggleBimestre('${b.id}')">
                    <div class="card-num" style="background-color: ${b.cor}">${b.id.replace('bimestre', '')}º</div>
                    <div style="flex: 1">
                        <h3 class="font-bold text-lg">${b.nome}</h3>
                        <p class="text-dim text-sm">${b.periodo}</p>
                    </div>
                    <i class="material-icons-round text-dim" id="icon-${b.id}">expand_more</i>
                </div>
                <div id="sub-${b.id}" class="hidden space-y-3 px-4 mb-6">
                    ${this.renderAvaliacoes(b.id)}
                </div>
            `;
        });

        html += `</div></div>`;
        this.app.innerHTML = html;
    },

    renderAvaliacoes(bimestreId) {
        const provas = [
            { id: 'avaliacao1', nome: 'Avaliação 1', icon: 'assignment' },
            { id: 'avaliacao2', nome: 'Avaliação 2', icon: 'assignment' },
            { id: 'bimestral', nome: 'Bimestral Final', icon: 'auto_awesome' }
        ];

        const bNome = bimestreId.replace('bimestre', '') + 'º Bimestre';

        return provas.map(p => `
            <div class="sub-item-card" onclick="App.currentBimestre='${bimestreId}'; App.currentProva='${p.id}'; App.currentBNome='${bNome}'; App.currentPNome='${p.nome}'; Router.go('disciplinas', { pNome: '${p.nome}', bNome: '${bNome}' })">
                <i class="material-icons-round text-primary" style="font-size: 1.8rem;">${p.icon}</i>
                <span class="font-bold text-lg">${p.nome}</span>
                <i class="material-icons-round text-dim ml-auto">chevron_right</i>
            </div>
        `).join('');
    },

    toggleBimestre(id) {
        const sub = document.getElementById('sub-' + id);
        const icon = document.getElementById('icon-' + id);
        const isHidden = sub.classList.contains('hidden');

        if (isHidden) {
            sub.classList.remove('hidden');
            icon.style.transform = 'rotate(180deg)';
        } else {
            sub.classList.add('hidden');
            icon.style.transform = 'rotate(0deg)';
        }
    },

    async renderDisciplinas(params) {
        const pNome = params.pNome || App.currentPNome;
        const bNome = params.bNome || App.currentBNome;

        const resp = await fetch(`api.php?acao=listar_disciplinas&ano=${App.prefs.ano_vigente}`);
        const json = await resp.json();
        if (!json.sucesso) {
            alert('Erro ao carregar disciplinas: ' + json.mensagem);
            return;
        }
        const disciplinas = json.dados;

        let html = `
            <div class="page-fade-in p-6 pb-32">
                <header class="mt-4 mb-8">
                    <div class="flex items-center gap-2 text-primary mb-2">
                        <span class="material-icons-round text-sm">calendar_today</span>
                        <span class="opacity-60 text-xs font-bold uppercase tracking-widest">Cronograma ${App.prefs.ano_vigente}</span>
                    </div>
                    <h1 class="text-4xl font-black tracking-tighter" style="font-size: 2.5rem;">${pNome}</h1>
                    <p class="text-dim font-bold text-lg">${bNome}</p>
                </header>

                <div id="progresso-area" class="mb-8">
                     <!-- Carregado via API -->
                </div>

                <div class="grid-2">
                    ${disciplinas.map(d => {
            const cor = d.cor || '#6366f1';
            return `
                            <div class="card-disciplina" 
                                 style="background: ${cor}15; border-color: ${cor}30;"
                                 onclick="Router.go('materiais', { disciplina_id: '${d.id}', nome: '${d.nome}' })">
                                
                                <div class="bg-circle" style="background: ${cor}"></div>

                                <div class="icon-box" style="background: ${cor}">
                                    <i class="material-icons-round text-3xl">${d.icone || 'menu_book'}</i>
                                </div>
                                <div class="content">
                                    <h3>${d.nome}</h3>
                                    <p style="color: ${cor}">Clique p/ Ver</p>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>

                ${disciplinas.length === 0 ? `
                    <div class="text-center py-20 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10 mt-8">
                        <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="material-icons-round text-dim">category</i>
                        </div>
                        <p class="text-dim font-bold">Nenhuma matéria mestre.</p>
                        <p class="text-xs text-dim opacity-50 mt-1 px-8">Adicione matérias na tela de Ajustes.</p>
                    </div>
                ` : ''}
            </div>
        `;
        this.app.innerHTML = html;

        // Carregar resumo de progresso real
        if (disciplinas.length > 0) {
            const resResp = await fetch(`api.php?acao=obter_resumo_progresso_prova&ano=${App.prefs.ano_vigente}&bimestre=${App.currentBimestre}&prova=${App.currentProva}`);
            const resJson = await resResp.json();
            if (resJson.sucesso) {
                const p = resJson.dados;
                document.getElementById('progresso-area').innerHTML = `
                    <div class="progresso-container">
                        <div class="progresso-header">
                             <i class="material-icons-round text-primary">auto_graph</i>
                             Seu Progresso de Estudo
                             <span class="ml-auto text-primary">${p.porcentagem}%</span>
                        </div>
                        <div class="barra-bg">
                            <div class="barra-fill" style="width: ${p.porcentagem}%"></div>
                        </div>
                        <div class="flex justify-between items-center mt-2">
                            <p class="text-xs text-dim italic opacity-60">"Você está indo no seu ritmo, Yara! ✨"</p>
                            <span class="text-[10px] uppercase font-bold tracking-widest opacity-40">${p.concluidos} de ${p.total} Materiais</span>
                        </div>
                    </div>
                `;
            }
        }
    },

    async renderMateriais(params) {
        const { disciplina_id, nome } = params;
        App.currentDisciplinaId = disciplina_id;

        const resp = await fetch(`api.php?acao=listar_materiais&bimestre=${App.currentBimestre}&prova=${App.currentProva}&disciplina_id=${disciplina_id}`);
        const json = await resp.json();
        if (!json.sucesso) {
            alert('Erro ao carregar materiais: ' + json.mensagem);
            return;
        }
        const materiais = json.dados;

        let html = `
            <div class="page-fade-in p-6 pb-32">
                <header class="mb-10">
                    <div class="flex items-center gap-4">
                        <button class="w-10 h-10 glass rounded-xl flex items-center justify-center transition-transform active:scale-90" onclick="Router.go('disciplinas', {})">
                            <i class="material-icons-round">arrow_back</i>
                        </button>
                        <div class="flex-1">
                             <h1 class="text-3xl font-black tracking-tight">${nome}</h1>
                             <p class="text-dim text-xs font-bold uppercase tracking-widest opacity-60">${App.currentBNome} • ${App.currentPNome}</p>
                        </div>
                    </div>
                </header>

                <div class="space-y-4">
        `;

        if (materiais.length === 0) {
            html += `
                <div class="text-center py-20 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
                    <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i class="material-icons-round text-dim text-4xl">folder_off</i>
                    </div>
                    <h3 class="font-bold text-xl mb-1 opacity-50">Nada por aqui ainda</h3>
                    <p class="text-dim text-sm px-10">O conteúdo deste bimestre será disponibilizado em breve.</p>
                </div>
            `;
        }

        materiais.forEach(m => {
            const iconMap = {
                youtube: 'smart_display',
                pdf: 'picture_as_pdf',
                audio: 'audiotrack',
                notebooklm: 'psychology',
                link: 'language'
            };
            const icon = iconMap[m.tipo] || 'article';

            const colorMap = {
                youtube: '#EF4444',
                pdf: '#F97316',
                audio: '#10B981',
                notebooklm: '#8B5CF6',
                link: '#3B82F6'
            };
            const cor = colorMap[m.tipo] || '#8B5CF6';

            html += `
                <div class="card-material" onclick="UI.abrirMaterial('${m.id}', '${m.titulo}', '${m.tipo}', '${m.url}')">
                    <div class="actions-left" onclick="event.stopPropagation(); App.toggleConclusao('${m.id}')">
                        <div class="check-box ${App.progresso.includes(m.id.toString()) ? 'checked' : ''}">
                            <i class="material-icons-round">done</i>
                        </div>
                    </div>

                    <div class="type-icon" style="background: ${cor}20; color: ${cor}">
                        <i class="material-icons-round text-3xl">${icon}</i>
                    </div>

                    <div class="material-info">
                        <h4>${m.titulo}</h4>
                        <div class="meta">
                            <span>${m.data}</span>
                            <span style="opacity: 0.2">•</span>
                            <span style="color: ${cor}">${m.tipo.toUpperCase()}</span>
                        </div>
                    </div>

                    <div class="actions">
                        ${App.user.tipo === 'Admin' ? `
                            <button class="btn-delete" onclick="event.stopPropagation(); UI.removerMaterial('${m.id}', '${nome}')">
                                <i class="material-icons-round text-xl">delete_outline</i>
                            </button>
                        ` : ''}
                        <i class="material-icons-round text-white/10 text-xl">chevron_right</i>
                    </div>
                </div>
            `;
        });

        html += `</div>
            ${App.user.tipo === 'Admin' ? `
                <button class="fab-fixed" onclick="UI.showAdicionarMaterial()">
                    <i class="material-icons-round text-3xl">add</i>
                </button>
            ` : ''}
        </div>`;
        this.app.innerHTML = html;
    },

    async removerMaterial(id, disciplinaNome) {
        if (!confirm('Deseja excluir este material permanentemente?')) return;
        App.verificarSenhaMestra(async () => {
            const resp = await fetch(`api.php?acao=remover_material&id=${id}&ano=${App.prefs.ano_vigente}&bimestre=${App.currentBimestre}&prova=${App.currentProva}&disciplina_id=${App.currentDisciplinaId}`);
            const json = await resp.json();
            if (json.sucesso) {
                this.renderMateriais({ disciplina_id: App.currentDisciplinaId, nome: disciplinaNome });
            }
        });
    },

    showAdicionarMaterial() {
        const titulo = prompt('Título do material:');
        if (!titulo) return;

        const tipo = prompt('Tipo (link, youtube, pdf, audio, notebooklm):', 'link');
        if (!tipo) return;

        const url = prompt('URL ou Link:');
        if (url) {
            this.adicionarMaterial(titulo, tipo, url);
        }
    },

    async adicionarMaterial(titulo, tipo, url) {
        await fetch('api.php?acao=adicionar_material', {
            method: 'POST',
            body: JSON.stringify({
                disciplina_id: App.currentDisciplinaId,
                bimestre: App.currentBimestre,
                prova: App.currentProva,
                titulo: titulo,
                tipo: tipo,
                url: url
            })
        });
        this.renderMateriais({ disciplina_id: App.currentDisciplinaId, nome: document.querySelector('h1').innerText });
    },

    abrirMaterial(id, titulo, tipo, url) {
        let content = '';

        if (tipo === 'youtube') {
            let videoId = '';
            if (url.includes('v=')) {
                videoId = url.split('v=')[1].split('&')[0];
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
            }
            content = `<iframe width="100%" height="300" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen class="rounded-2xl"></iframe>`;
        } else if (tipo === 'pdf') {
            content = `<iframe src="${url}" width="100%" height="500px" style="border-radius: 1.5rem; border: none;"></iframe>`;
        } else if (tipo === 'audio') {
            content = `
                <div class="text-center p-8 glass rounded-2xl">
                    <div class="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i class="material-icons-round text-5xl">audiotrack</i>
                    </div>
                    <audio controls class="w-full">
                        <source src="${url}" type="audio/mpeg">
                        Seu navegador não suporta áudio.
                    </audio>
                    <p class="text-xs text-dim mt-4">Player de Áudio Nativo (MP3)</p>
                </div>
            `;
        } else if (tipo === 'notebooklm') {
            content = `
                <div class="p-8 text-center glass rounded-2xl">
                    <div class="w-20 h-20 bg-purple-500/20 text-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-purple-500/20">
                        <i class="material-icons-round text-5xl">psychology</i>
                    </div>
                    <h3 class="text-xl font-bold mb-2">NotebookLM AI</h3>
                    <p class="text-dim text-sm italic mb-4">"Este conteúdo deve ser aberto no ambiente do Google para áudio interativo."</p>
                    
                    <div class="bg-primary/10 p-4 rounded-xl border border-primary/20 mb-6 text-xs text-left">
                        <div class="flex items-center gap-2 mb-1 text-primary">
                            <i class="material-icons-round text-sm">tips_and_updates</i>
                            <span class="font-bold">Dica da Yara:</span>
                        </div>
                        Quando a página abrir, procure pela opção <strong class="text-white">"Estúdio"</strong> no menu do Google para encontrar o player e ouvir o áudio! 🎧
                    </div>

                    <a href="${url}" target="_blank" class="btn-primary w-full justify-center" style="background: #8B5CF6">
                        <i class="material-icons-round">open_in_new</i>
                        Abrir no Google Notebook
                    </a>
                </div>
            `;
        } else {
            content = `
                <div class="p-8 text-center glass rounded-2xl">
                    <p class="mb-4 text-dim">Este é um link externo.</p>
                    <a href="${url}" target="_blank" class="btn-primary">Abrir Link Externo</a>
                </div>
            `;
        }

        const modalHtml = `
            <div id="viewer" class="modal-overlay page-fade-in">
                <header class="modal-header">
                    <h2>${titulo}</h2>
                    <button onclick="document.getElementById('viewer').remove()" class="btn-close">
                        <i class="material-icons-round">close</i>
                    </button>
                </header>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    async renderPreferencias() {
        if (App.user.tipo !== 'Admin') {
            Router.go('dashboard');
            return;
        }

        try {
            const resp = await fetch(`api.php?acao=listar_disciplinas&ano=${App.prefs.ano_vigente}`);
            const jsonDisc = await resp.json();
            const disciplinas = jsonDisc.dados || [];

            const respAmigos = await fetch('api.php?acao=listar_amigos');
            const jsonAmigos = await respAmigos.json();
            const amigos = jsonAmigos.dados || [];

            this.app.innerHTML = `
            <div class="page-fade-in p-6 pb-40">
                <header class="mb-8 flex items-center gap-4">
                    <button class="w-10 h-10 glass rounded-xl flex items-center justify-center" onclick="Router.go('dashboard')">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <div>
                        <h1 class="text-2xl font-bold">Preferências</h1>
                        <p class="text-dim text-sm">Configurações globais do sistema</p>
                    </div>
                </header>

                <div class="space-y-6">
                    <div class="glass p-8 rounded-[2.5rem]">
                        <div class="section-header">
                            <div class="title-group">
                                <i class="material-icons-round">calendar_today</i>
                                <h3>Ano Letivo Vigente</h3>
                            </div>
                        </div>
                        <div class="input-group">
                            <label class="mb-2 block">ANO ATUAL</label>
                            <input type="text" id="pref-ano" class="input-field" value="${App.prefs.ano_vigente}">
                        </div>
                        <div class="mt-8 flex justify-end">
                            <button class="btn-primary w-fit px-8" onclick="UI.salvarPreferencias()">
                                <i class="material-icons-round">save</i>
                                Salvar Ano
                            </button>
                        </div>
                    </div>

                    <div class="glass p-8 rounded-[2.5rem]">
                        <div class="section-header">
                            <div class="title-group">
                                <i class="material-icons-round">auto_stories</i>
                                <h3>Disciplinas do Ano</h3>
                            </div>
                            <button class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary" onclick="UI.showAdicionarDisciplinaMestre()">
                                <i class="material-icons-round">add</i>
                            </button>
                        </div>
                        <div class="space-y-4">
                            ${disciplinas.map(d => `
                                <div class="sub-item-card">
                                    <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white" style="background: ${d.cor}">
                                        <i class="material-icons-round">${d.icone || 'book'}</i>
                                    </div>
                                    <div class="flex-1">
                                        <span class="font-bold text-lg block">${d.nome}</span>
                                    </div>
                                    <button class="btn-delete" onclick="UI.removerDisciplinaMestre('${d.id}')">
                                        <i class="material-icons-round">delete_outline</i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="glass p-8 rounded-[2.5rem]">
                        <div class="section-header">
                            <div class="title-group">
                                <i class="material-icons-round">group</i>
                                <h3>Chaves de Amigos</h3>
                            </div>
                            <button class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary" onclick="UI.showGerarChaveAmigo()">
                                <i class="material-icons-round">add</i>
                            </button>
                        </div>
                        <div class="space-y-4">
                            ${amigos.map(a => `
                                <div class="sub-item-card" onclick="App.compartilharAcessoAmigo('${a.nome}', '${a.usuario}', '${a.senha}')">
                                    <div class="flex-1">
                                        <h4 class="font-bold text-white">${a.nome}</h4>
                                        <p class="text-xs text-dim">Usuário: ${a.usuario} | Senha: ${a.senha}</p>
                                    </div>
                                    <button class="btn-delete" onclick="event.stopPropagation(); UI.removerAmigo('${a.id}')">
                                        <i class="material-icons-round">delete_outline</i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        } catch (e) {
            console.error('Erro ao renderizar preferências:', e);
            alert('Erro ao carregar configurações. Tente novamente.');
            Router.go('dashboard');
        }
    },

    showAdicionarDisciplinaMestre() {
        const nome = prompt('Nome da Disciplina:');
        if (!nome) return;
        const cor = prompt('Cor (Hex):', '#6366f1');
        const icone = prompt('Ícone:', 'book');
        this.adicionarDisciplinaMestre(nome, cor, icone);
    },

    async adicionarDisciplinaMestre(nome, cor, icone) {
        await fetch('api.php?acao=adicionar_disciplina_mestre', {
            method: 'POST',
            body: JSON.stringify({ nome, cor, icone, ano: App.prefs.ano_vigente })
        });
        this.renderPreferencias();
    },

    async removerDisciplinaMestre(id) {
        if (!confirm('Excluir disciplina?')) return;
        App.verificarSenhaMestra(async () => {
            await fetch(`api.php?acao=remover_disciplina_mestre&id=${id}&ano=${App.prefs.ano_vigente}`);
            this.renderPreferencias();
        });
    },

    showGerarChaveAmigo() {
        const nome = prompt('Nome da Amiga:');
        if (!nome) return;
        this.gerarChaveAmigo(nome);
    },

    async gerarChaveAmigo(nome) {
        await fetch('api.php?acao=gerar_chave_amigo', {
            method: 'POST',
            body: JSON.stringify({ nome })
        });
        this.renderPreferencias();
    },

    async removerAmigo(id) {
        if (!confirm('Remover acesso?')) return;
        App.verificarSenhaMestra(async () => {
            await fetch(`api.php?acao=remover_amigo&id=${id}`);
            this.renderPreferencias();
        });
    },

    async salvarPreferencias() {
        const novoAno = document.getElementById('pref-ano').value;
        if (!novoAno) return;
        App.verificarSenhaMestra(async () => {
            const resp = await fetch('api.php?acao=salvar_preferencias', {
                method: 'POST',
                body: JSON.stringify({ ano_vigente: novoAno })
            });
            if ((await resp.json()).sucesso) {
                App.prefs.ano_vigente = novoAno;
                location.reload();
            }
        });
    }
};

App.init();

// Registro do Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrado!', reg))
            .catch(err => console.log('Erro ao registrar SW:', err));
    });
}

// Captura do evento de instalação PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    App.deferredPrompt = e;
    // Se estiver na tela de login, re-renderizar para mostrar o botão
    if (App.currentRoute === 'login') {
        UI.renderLogin();
    }
});

window.addEventListener('appinstalled', () => {
    App.deferredPrompt = null;
    console.log('App instalado com sucesso!');
});
