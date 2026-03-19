---
description: Fazer commit e push das alterações para o GitHub
---

# Push para o GitHub

Enviar todas as alterações feitas no projeto para o repositório remoto no GitHub.

## Passos

// turbo-all

1. Atualizar o PATH para incluir o Git:
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

2. Navegar até o repositório e adicionar todos os arquivos modificados:
```powershell
cd "C:\Users\Administrator\.gemini\antigravity\scratch\rose-inject-magic" && git add -A
```

3. Perguntar ao usuário qual mensagem de commit ele quer usar. Se ele não especificar, usar uma mensagem automática com data/hora.

4. Fazer o commit:
```powershell
git commit -m "<mensagem do commit>"
```

5. Fazer o push para o GitHub:
```powershell
git push origin main
```

6. Confirmar ao usuário que o push foi realizado com sucesso.
