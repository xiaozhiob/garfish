import { interfaces } from '@garfish/core';
import { createKey } from '@garfish/utils';
import router, {
  initRedirect,
  listenRouterAndReDirect,
  RouterInterface,
} from './context';
import './globalExtensions';

interface Options {
  autoRefreshApp?: boolean;
  onNotMatchRouter?: (path: string) => Promise<void> | void;
}

export default function Router(_args?: Options) {
  return function (Garfish: interfaces.Garfish): interfaces.Plugin {
    Garfish.router = router;
    return {
      name: 'router',
      version: __VERSION__,
      bootstrap(options) {
        let activeApp = null;
        const unmounts: Record<string, Function> = {};
        const { apps, basename } = options;
        const {
          autoRefreshApp = true,
          onNotMatchRouter = () => null,
        } = Garfish.options;

        async function active(appInfo: interfaces.AppInfo, rootPath: string) {
          const { name, cache, active } = appInfo;
          if (active) return active(appInfo, rootPath);

          const currentApp = (activeApp = createKey());
          const app = await Garfish.loadApp(appInfo.name, {
            basename: rootPath,
            entry: appInfo.entry,
            domGetter: appInfo.domGetter || options.domGetter,
          });

          const call = (app: interfaces.App, isRender: boolean) => {
            if (!app) return;
            const isDes = cache && app.mounted;
            const fn = isRender
              ? app[isDes ? 'show' : 'mount']
              : app[isDes ? 'hide' : 'unmount'];
            return fn.call(app);
          };

          Garfish.activeApps[name] = app;
          unmounts[name] = () => call(app, false);

          if (currentApp === activeApp) {
            await call(app, true);
          }
        }

        async function deactive(appInfo: interfaces.AppInfo, rootPath: string) {
          activeApp = null;
          const { name, deactive } = appInfo;
          if (deactive) return deactive(appInfo, rootPath);

          const unmount = unmounts[name];
          unmount && unmount();
          delete Garfish.activeApps[name];
        }

        const appList = apps.filter(
          (app) => app.activeWhen !== null && app.activeWhen !== undefined,
        ) as Array<Required<interfaces.AppInfo>>;

        if (appList.length === 0) return;

        const listenOptions = {
          basename,
          active,
          deactive,
          autoRefreshApp,
          notMatch: onNotMatchRouter,
          apps: appList,
        };

        listenRouterAndReDirect(listenOptions);
      },

      registerApp(appInfos) {
        // Has been running after adding routing to trigger the redirection
        if (!Garfish.running) return;

        const appList = Object.keys(appInfos).map((key) => {
          return appInfos[key];
        });
        router.registerRouter(appList);

        // After completion of the registration application, trigger application mount
        initRedirect();
      },
    };
  };
}

export { RouterInterface } from './context';
