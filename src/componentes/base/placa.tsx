interface Props {
  readonly valor: string;
  readonly descricao: string;
  readonly tom?: 'neutro' | 'quente' | 'atencao' | 'bom';
}

/**
 * Placa de indicador.
 *
 * O tom só muda quando o número exige ação — colorir tudo faz nada se destacar.
 * O valor é tabular para alinhar quando as placas ficam lado a lado.
 */
export function Placa({ valor, descricao, tom = 'neutro' }: Props) {
  return (
    <div className="placa" data-tom={tom === 'neutro' ? undefined : tom}>
      <span className="placa-valor">{valor}</span>
      <span className="placa-descricao">{descricao}</span>
    </div>
  );
}
