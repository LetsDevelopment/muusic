import { TableCell, TableRow } from './Table';

export default function TableEmptyRow({ colSpan, title = 'Sem dados', description = 'Não há informações suficientes para exibir nesta tabela.' }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-10">
        <div className="flex flex-col items-center justify-center gap-1 text-center">
          <p className="text-[14px] font-medium text-foreground">{title}</p>
          <p className="text-[13px] text-muted-foreground">{description}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
