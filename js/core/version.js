/* Единый источник версии — меняется только здесь */
export const VERSION='1.1';
export const BUILD='2026.11.24';
export const CODENAME='Пульсар';
export const KERNEL='6.2.0-nebula';

/* Канал сборки: dev — предварительная версия большого обновления. */
export const CHANNEL='dev';
export const IN_DEV=true;
export const CHANNEL_LABEL='в разработке';
export const CHANNEL_SHORT='DEV';
export const REPO='https://github.com/gtfrtfd-rgb/NEBULA-OS';

export const OS_NAME=`NEBULA OS ${VERSION} «${CODENAME}»${IN_DEV?' · '+CHANNEL_LABEL:''}`;
export const BUILD_LINE=`Версия ${VERSION} «${CODENAME}» · сборка ${BUILD}${IN_DEV?' · '+CHANNEL_LABEL:''}`;
export const SHORT_LINE=`OS · ${VERSION} «${CODENAME}»`;
export const PAGE_TITLE=`NEBULA OS ${VERSION} — веб-операционная система`;

/* Идентификатор сборки, ЗАШИТЫЙ в исполняемый код.
   Пайплайн подставляет SHA при публикации; в репозитории остаётся placeholder. */
export const RUNNING_BUILD='__BUILD_ID__';

/* Метка из HTML — сборка, которая лежит на сервере прямо сейчас. */
export const DEPLOY_STAMP=(document.querySelector('meta[name="nebula-build"]')?.content||'').trim();
export const SERVER_BUILD=(DEPLOY_STAMP.split('·')[0]||'').trim();