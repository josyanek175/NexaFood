import { Skeleton } from "@/components/ui/skeleton";
import { brl } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({ product, onSelect }: { product: Product; onSelect: () => void }) {
  const price = product.promo_price ?? product.price;
  return (
    <button
      onClick={onSelect}
      disabled={!product.available}
      className="group flex w-full items-stretch gap-4 rounded-2xl border bg-card p-3 text-left shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="min-w-0 flex-1 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-bold sm:text-base">{product.name}</h3>
          {product.promo_price && (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
              Promoção
            </span>
          )}
          {!product.available && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              Indisponível
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {product.description}
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-sm font-bold text-primary sm:text-base">{brl(price)}</span>
          {product.promo_price && (
            <span className="text-xs text-muted-foreground line-through">{brl(product.price)}</span>
          )}
        </div>
      </div>
      <div className="relative size-24 shrink-0 overflow-hidden rounded-xl sm:size-28">
        <img
          src={product.image_url}
          alt={product.name}
          width={800}
          height={600}
          loading="lazy"
          className="size-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
    </button>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl border bg-card p-3">
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="mt-3 h-4 w-20" />
      </div>
      <Skeleton className="size-24 rounded-xl sm:size-28" />
    </div>
  );
}
