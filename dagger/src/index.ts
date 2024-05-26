/**
 * Metabase local dev resources
 */
import { dag, Container, Directory, Service, object, func, ClientPostgresOpts } from "@dagger.io/dagger"

@object()
class MetabaseLocal {
  /**
   * Returns a container with Metabase and dependencies installed
   */
  @func()
  base(source: Directory): Container {
        const ubuntuImage = "ubuntu:noble-20240429"
        const cljRel = "1.11.3.1463"

        const cljInstaller = `https://github.com/clojure/brew-install/releases/download/${cljRel}/linux-install.sh`
    return dag
            .container()
            .from(ubuntuImage)
            .withExec([
                "apt",
                "update",
            ])
            .withExec([
                "apt",
                "install",
                "openjdk-11-jdk",
                "nodejs",
                "npm",
                "curl",
                "rlwrap",
                "-y",
            ])
            .withExec([
                "npm",
                "install",
                "--global",
                "yarn",
            ])
            .withWorkdir("/tmp")
            .withExec([
                "bash",
                "-c",
                `curl -L -O ${cljInstaller} && chmod +x linux-install.sh && ./linux-install.sh`,
            ])
            .withMountedCache(
        "/usr/local/share/.cache/yarn",
        dag.cacheVolume("node-module-yarn"),
            )
            .withMountedCache(
        "/root/.replay/runtimes",
        dag.cacheVolume("replay-runtimes"),
            )
            .withMountedCache(
        "/root/.cache/Cypress",
        dag.cacheVolume("cypress"),
            )
            .withMountedCache(
        "/root/.gitlibs",
        dag.cacheVolume("gitlibs"),
            )
            .withMountedCache(
        "/root/.m2/repository",
        dag.cacheVolume("maven"),
            )
            .withMountedDirectory("/workspace/metabase", source)
            .withWorkdir("/workspace/metabase")
  }

    /**
     * Returns a Service with Metabase frontend & backend
     */
    @func()
    local(source: Directory): Service {
        return this.base(source)
            .withExec([
                "yarn",
                "build",
            ])
            .withExec([
                "clojure",
                "-M:run",
            ])
            .withExposedPort(3000)
            .asService()
    }

    /**
     * Returns a Service with Metabase and a Postgres DB
     */
    @func()
    demo(source: Directory): Service {
        const dbUser = "metabase"
        const dbPassword = "metabase"

        const pg = dag.postgres(
            dag.setSecret("dbUser", dbUser),
            dag.setSecret("dbPassword", dbPassword),
            {
                dbPort: 5432,
                dbName: "metabase",
            } as ClientPostgresOpts
        ).database()

        return this.base(source)
            .withExec([
                "yarn",
                "build",
            ])
            .withEnvVariable("MB_DB_TYPE", "postgres")
            .withEnvVariable("MB_DB_DBNAME", "metabase")
            .withEnvVariable("MB_DB_PORT", "5432")
            .withEnvVariable("MB_DB_USER", dbUser)
            .withEnvVariable("MB_DB_PASS", dbPassword)
            .withEnvVariable("MB_DB_HOST", "db")
            .withServiceBinding("db", pg.asService())
            .withExec([
                "clojure",
                "-M:run",
            ])
            .withExposedPort(3000)
            .asService()
    }
}
