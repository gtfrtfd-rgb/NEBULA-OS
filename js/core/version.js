/* Единый источник версии — меняется только здесь */
export const VERSION='1.0.2';
export const BUILD='2026.11.22';
export const CODENAME='Пульсар';
export const KERNEL='6.2.0-nebula';
export const OS_NAME=`NEBULA OS ${VERSION} «${CODENAME}»`;
export const BUILD_LINE=`Версия ${VERSION} «${CODENAME}» · сборка ${BUILD}`;
export const SHORT_LINE=`OS · ${VERSION} «${CODENAME}»`;
export const PAGE_TITLE=`NEBULA OS ${VERSION} — веб-операционная система`;
/* метку публикации проставляет пайплайн GitHub Pages; локально её нет */
export const DEPLOY_STAMP=(document.querySelector('meta[name="nebula-build"]')?.content||'').trim();