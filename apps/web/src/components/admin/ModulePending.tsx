import { Link } from "@tanstack/react-router";
import { PageHeader } from "./ui";
export function ModulePending({ title }: { title: string }) {
  return <section><PageHeader title={title} description="Este módulo ainda não está disponível para operação." />
    <p className="mb-4 text-muted-foreground">Os cadastros, conexões e ações desta área serão liberados quando a integração estiver concluída. Nenhuma operação foi realizada.</p>
    <Link to="/admin" className="font-medium underline">Voltar à visão geral</Link>
  </section>;
}
