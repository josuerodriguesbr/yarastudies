<?php
session_start();

$base_dir = __DIR__ . '/data';

header('Content-Type: application/json');

function responder($sucesso, $dados = null, $mensagem = '') {
    echo json_encode([
        'sucesso' => $sucesso,
        'dados' => $dados,
        'mensagem' => $mensagem
    ]);
    exit;
}

function obterAnoVigente() {
    $pref_file = __DIR__ . '/data/preferencias.json';
    if (file_exists($pref_file)) {
        $prefs = json_decode(file_get_contents($pref_file), true);
        return $prefs['ano_vigente'] ?? '2026';
    }
    return '2026';
}

function verificarAutorizacaoMaster() {
    if (!isset($_SESSION['master_authorized']) || $_SESSION['master_authorized'] !== true) {
        responder(false, null, 'Senha mestra necessária para esta ação.');
    }
}

$acao = $_GET['acao'] ?? '';

if ($acao === 'login') {
    $raw = file_get_contents('php://input');
    $dados = json_decode($raw, true);
    $usuario = $dados['usuario'] ?? '';
    $senha = $dados['senha'] ?? '';

    $diretorio_usuarios = $base_dir . '/usuarios';
    $arquivos = glob($diretorio_usuarios . '/*.json');

    foreach ($arquivos as $arquivo) {
        $user_data = json_decode(file_get_contents($arquivo), true);
        if ($user_data['usuario'] === $usuario && $user_data['senha'] === $senha) {
            $_SESSION['usuario_id'] = $user_data['id'];
            $_SESSION['tipo'] = $user_data['tipoUsuario'];
            $_SESSION['nome'] = $user_data['nome'];
            $_SESSION['master_authorized'] = false; // Resetar ao logar
            responder(true, [
                'id' => $user_data['id'],
                'nome' => $user_data['nome'],
                'tipo' => $user_data['tipoUsuario']
            ]);
        }
    }
    responder(false, null, 'Usuário ou senha incorretos.');
}

if ($acao === 'validar_senha_mestra') {
    $raw = file_get_contents('php://input');
    $dados = json_decode($raw, true);
    $senha = $dados['senha'] ?? '';
    
    // A senha agora fica protegida no servidor
    if ($senha === 'SuperMaster') {
        $_SESSION['master_authorized'] = true;
        responder(true, null, 'Autorizado!');
    }
    responder(false, null, 'Senha incorreta.');
}

if ($acao === 'logout') {
    session_destroy();
    responder(true);
}

if ($acao === 'verificar_sessao') {
    if (isset($_SESSION['usuario_id'])) {
        responder(true, [
            'id' => $_SESSION['usuario_id'],
            'nome' => $_SESSION['nome'],
            'tipo' => $_SESSION['tipo']
        ]);
    }
    responder(false);
}

if ($acao === 'obter_preferencias') {
    $pref_file = $base_dir . '/preferencias.json';
    if (file_exists($pref_file)) {
        responder(true, json_decode(file_get_contents($pref_file), true));
    }
    responder(true, ['ano_vigente' => '2026']);
}

// Ações protegidas
if (!isset($_SESSION['usuario_id'])) {
    responder(false, null, 'Não autorizado');
}

if ($acao === 'salvar_preferencias') {
    if ($_SESSION['tipo'] !== 'Admin') responder(false, null, 'Apenas Admin pode configurar.');
    verificarAutorizacaoMaster();
    
    $raw = file_get_contents('php://input');
    $dados = json_decode($raw, true);
    $pref_file = $base_dir . '/preferencias.json';
    
    $novo_ano = $dados['ano_vigente'] ?? '2026';
    
    // Garantir estrutura para o novo ano
    $provas = ['avaliacao1', 'avaliacao2', 'bimestral'];
    $bimestres = ['bimestre1', 'bimestre2', 'bimestre3', 'bimestre4'];
    
    foreach ($bimestres as $b) {
        foreach ($provas as $p) {
            $path = "$base_dir/anos/$novo_ano/$b/$p";
            if (!is_dir($path)) {
                mkdir($path, 0777, true);
                if (!file_exists("$path/disciplinas.json")) {
                    file_put_contents("$path/disciplinas.json", json_encode([]));
                }
            }
        }
    }
    
    file_put_contents($pref_file, json_encode($dados, JSON_PRETTY_PRINT));
    responder(true, $dados, 'Preferências salvas e estrutura de pastas criada!');
}

if ($acao === 'obter_progresso') {
    $uid = $_SESSION['usuario_id'];
    $prog_file = "$base_dir/usuarios/progresso_$uid.json";
    if (file_exists($prog_file)) {
        $data = json_decode(file_get_contents($prog_file), true);
        responder(true, is_array($data) ? $data : []);
    }
    responder(true, []);
}

if ($acao === 'toggle_material_concluido') {
    $uid = $_SESSION['usuario_id'];
    if (!is_dir("$base_dir/usuarios")) mkdir("$base_dir/usuarios", 0777, true);
    
    $raw = file_get_contents('php://input');
    $dados = json_decode($raw, true);
    $mid = $dados['id'];
    
    $prog_file = "$base_dir/usuarios/progresso_$uid.json";
    $progresso = file_exists($prog_file) ? json_decode(file_get_contents($prog_file), true) : [];
    
    if (in_array($mid, $progresso)) {
        $progresso = array_values(array_filter($progresso, fn($id) => $id != $mid));
    } else {
        $progresso[] = $mid;
    }
    
    file_put_contents($prog_file, json_encode($progresso));
    responder(true, $progresso);
}

if ($acao === 'obter_resumo_progresso_prova') {
    $ano = $_GET['ano'] ?? obterAnoVigente();
    $bimestre = $_GET['bimestre'] ?? 'bimestre1';
    $prova = $_GET['prova'] ?? 'avaliacao1';
    $uid = $_SESSION['usuario_id'];

    // Obter concluídos do usuário
    $prog_file = "$base_dir/usuarios/progresso_$uid.json";
    $concluidos = file_exists($prog_file) ? json_decode(file_get_contents($prog_file), true) : [];
    if (!is_array($concluidos)) $concluidos = [];

    // Obter disciplinas mestre para saber quais pastas olhar
    $mestre_file = "$base_dir/anos/$ano/disciplinas_mestre.json";
    $disciplinas = file_exists($mestre_file) ? json_decode(file_get_contents($mestre_file), true) : [];
    if (!is_array($disciplinas)) $disciplinas = [];

    $total_materiais = 0;
    $materiais_concluidos = 0;

    foreach ($disciplinas as $d) {
        $did = $d['id'];
        $path = "$base_dir/anos/$ano/$bimestre/$prova/m_$did/materiais.json";
        if (file_exists($path)) {
            $materiais = json_decode(file_get_contents($path), true);
            foreach ($materiais as $m) {
                $total_materiais++;
                if (in_array($m['id'], $concluidos)) {
                    $materiais_concluidos++;
                }
            }
        }
    }

    $porcentagem = $total_materiais > 0 ? round(($materiais_concluidos / $total_materiais) * 100) : 0;
    
    responder(true, [
        'total' => $total_materiais,
        'concluidos' => $materiais_concluidos,
        'porcentagem' => $porcentagem
    ]);
}

// Listar Disciplinas (agora usando a lista mestre do ano)
if ($acao === 'listar_disciplinas') {
    $ano = $_GET['ano'] ?? obterAnoVigente();
    $path = "$base_dir/anos/$ano";
    
    $file = "$path/disciplinas_mestre.json";
    if (!file_exists($file)) {
        if (!is_dir($path)) mkdir($path, 0777, true);
        file_put_contents($file, json_encode([]));
    }
    
    $conteudo = @file_get_contents($file);
    $data = json_decode($conteudo, true);
    responder(true, is_array($data) ? $data : []);
}

// Ações de Disciplinas Mestre (Preferências)
if ($acao === 'adicionar_disciplina_mestre') {
    if ($_SESSION['tipo'] !== 'Admin') responder(false, null, 'Apenas Admin pode configurar.');
    verificarAutorizacaoMaster();
    
    $raw = file_get_contents('php://input');
    $dados = json_decode($raw, true);
    $ano = $dados['ano'] ?? obterAnoVigente();
    
    $path = "$base_dir/anos/$ano";
    $file = "$path/disciplinas_mestre.json";
    
    if (!is_dir($path)) mkdir($path, 0777, true);
    
    $disciplinas = file_exists($file) ? json_decode(file_get_contents($file), true) : [];
    
    $nova = [
        'id' => time(),
        'nome' => $dados['nome'],
        'cor' => $dados['cor'] ?? '#6366f1',
        'icone' => $dados['icone'] ?? 'book'
    ];
    
    $disciplinas[] = $nova;
    file_put_contents($file, json_encode($disciplinas, JSON_PRETTY_PRINT));
    responder(true, $nova);
}

if ($acao === 'remover_disciplina_mestre') {
    if ($_SESSION['tipo'] !== 'Admin') responder(false, null, 'Apenas Admin pode configurar.');
    verificarAutorizacaoMaster();
    
    $id = $_GET['id'];
    $ano = $_GET['ano'] ?? obterAnoVigente();
    $file = "$base_dir/anos/$ano/disciplinas_mestre.json";
    
    if (file_exists($file)) {
        $disciplinas = json_decode(file_get_contents($file), true);
        $disciplinas = array_values(array_filter($disciplinas, fn($d) => $d['id'] != $id));
        file_put_contents($file, json_encode($disciplinas, JSON_PRETTY_PRINT));
    }
    responder(true);
}

// Gestão de Amigos (Convidados)
if ($acao === 'listar_amigos') {
    if ($_SESSION['tipo'] !== 'Admin') responder(false, null, 'Apenas Admin pode ver.');
    
    $diretorio_usuarios = $base_dir . '/usuarios';
    if (!is_dir($diretorio_usuarios)) mkdir($diretorio_usuarios, 0777, true);
    
    $arquivos = glob($diretorio_usuarios . '/*.json');
    if (!is_array($arquivos)) $arquivos = [];
    
    $amigos = [];

    foreach ($arquivos as $arquivo) {
        $raw = @file_get_contents($arquivo);
        if (!$raw) continue;
        $user_data = json_decode($raw, true);
        if (isset($user_data['tipoUsuario']) && $user_data['tipoUsuario'] === 'Convidado') {
            $amigos[] = [
                'id' => $user_data['id'],
                'nome' => $user_data['nome'],
                'usuario' => $user_data['usuario'],
                'senha' => $user_data['senha']
            ];
        }
    }
    responder(true, $amigos);
}

if ($acao === 'gerar_chave_amigo') {
    if ($_SESSION['tipo'] !== 'Admin') responder(false, null, 'Apenas Admin pode gerar.');
    verificarAutorizacaoMaster();
    
    $raw = file_get_contents('php://input');
    $dados = json_decode($raw, true);
    $nome = $dados['nome'] ?? 'Amiga';
    
    $id = time();
    $usuario = strtolower(str_replace(' ', '', $nome)) . rand(10, 99);
    $senha = rand(1000, 9999);
    
    $novo_usuario = [
        'id' => $id,
        'tipoUsuario' => 'Convidado',
        'nome' => $nome,
        'usuario' => $usuario,
        'senha' => (string)$senha,
        'telefone' => ''
    ];
    
    $file = $base_dir . "/usuarios/$id.json";
    if (!is_dir($base_dir . "/usuarios")) mkdir($base_dir . "/usuarios", 0777, true);
    
    file_put_contents($file, json_encode($novo_usuario, JSON_PRETTY_PRINT));
    responder(true, $novo_usuario);
}

if ($acao === 'remover_amigo') {
    if ($_SESSION['tipo'] !== 'Admin') responder(false, null, 'Apenas Admin pode remover.');
    verificarAutorizacaoMaster();
    
    $id = $_GET['id'];
    $file = $base_dir . "/usuarios/$id.json";
    
    if (file_exists($file)) {
        unlink($file);
    }
    responder(true);
}

// Listar Materiais
if ($acao === 'listar_materiais') {
    $ano = $_GET['ano'] ?? obterAnoVigente();
    $bimestre = $_GET['bimestre'] ?? 'bimestre1';
    $prova = $_GET['prova'] ?? 'avaliacao1';
    $disciplina_id = $_GET['disciplina_id'] ?? '';
    
    $path = "$base_dir/anos/$ano/$bimestre/$prova/m_$disciplina_id";
    if (!is_dir($path)) {
        mkdir($path, 0777, true);
    }
    
    $materiais_file = "$path/materiais.json";
    if (!file_exists($materiais_file)) {
        file_put_contents($materiais_file, json_encode([]));
    }
    
    responder(true, json_decode(file_get_contents($materiais_file), true));
}

// Adicionar Material
if ($acao === 'adicionar_material') {
    if ($_SESSION['tipo'] !== 'Admin') responder(false, null, 'Apenas Admin pode adicionar.');
    
    $raw = file_get_contents('php://input');
    $dados = json_decode($raw, true);
    
    $disciplina_id = $dados['disciplina_id'];
    $ano = $dados['ano'] ?? obterAnoVigente();
    $bimestre = $dados['bimestre'] ?? 'bimestre1';
    $prova = $dados['prova'] ?? 'avaliacao1';
    
    $path = "$base_dir/anos/$ano/$bimestre/$prova/m_$disciplina_id";
    $materiais_file = "$path/materiais.json";
    
    $materiais = json_decode(file_get_contents($materiais_file), true);
    $novo_material = [
        'id' => time(),
        'titulo' => $dados['titulo'],
        'tipo' => $dados['tipo'], // link, youtube, pdf, audio
        'url' => $dados['url'],
        'data' => date('d/m/Y')
    ];
    $materiais[] = $novo_material;
    
    file_put_contents($materiais_file, json_encode($materiais, JSON_PRETTY_PRINT));
    responder(true, $novo_material);
}

if ($acao === 'remover_material') {
    if ($_SESSION['tipo'] !== 'Admin') responder(false, null, 'Apenas Admin pode remover.');
    verificarAutorizacaoMaster();
    
    $id = $_GET['id'];
    $ano = $_GET['ano'] ?? obterAnoVigente();
    $bimestre = $_GET['bimestre'] ?? 'bimestre1';
    $prova = $_GET['prova'] ?? 'avaliacao1';
    $disciplina_id = $_GET['disciplina_id'];
    
    $path = "$base_dir/anos/$ano/$bimestre/$prova/m_$disciplina_id";
    $file = "$path/materiais.json";
    
    if (file_exists($file)) {
        $materiais = json_decode(file_get_contents($file), true);
        $materiais = array_values(array_filter($materiais, fn($m) => $m['id'] != $id));
        file_put_contents($file, json_encode($materiais, JSON_PRETTY_PRINT));
    }
    responder(true);
}
?>
