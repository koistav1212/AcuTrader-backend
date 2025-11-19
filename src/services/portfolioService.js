import { prisma } from "../config/db.js";

export async function getUserPortfolio(userId) {
  const [holdings, orders, watchlist] = await Promise.all([
    prisma.holding.findMany({ where: { userId } }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.watchlist.findMany({ where: { userId } })
  ]);

  return { holdings, orders, watchlist };
}

export async function toggleWatchlist(userId, symbol) {
  const existing = await prisma.watchlist.findFirst({
    where: { userId, symbol }
  });

  if (existing) {
    await prisma.watchlist.delete({ where: { id: existing.id } });
    return { inWatchlist: false };
  } else {
    await prisma.watchlist.create({ data: { userId, symbol } });
    return { inWatchlist: true };
  }
}
