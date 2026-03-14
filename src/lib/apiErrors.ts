export function throwApiError(status: number): never {
  if (status === 403) {
    throw new Error("Esta conta não está mais disponível. Ela pode ter sido vendida ou removida pelo vendedor.");
  }
  if (status === 502 || status === 503) {
    throw new Error("O serviço de contas está temporariamente instável. Tente novamente em alguns segundos.");
  }
  if (status === 429) {
    throw new Error("Muitas requisições. Aguarde um momento e tente novamente.");
  }
  if (status === 500) {
    throw new Error("Erro interno do servidor. Tente novamente mais tarde.");
  }
  throw new Error(`Erro ao conectar com o serviço (código ${status}).`);
}
