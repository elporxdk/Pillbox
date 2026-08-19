import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import { esAdmin } from "@/lib/fotosCreadores";
import {
  NOMBRE_DEL_TIPO,
  SECCIONES,
  TIPOS,
  borrarBloque,
  crearBloque,
  filas,
  guardarBloque,
  intercambiarOrden,
  leerBloques,
  porSeccion,
  subirImagen,
  texto,
  type Bloque,
  type Tipo,
} from "@/lib/tecnologia";

/**
 * Panel para editar la sección de Tecnología.
 *
 * SOLO SE VE SIENDO ADMINISTRADOR, PERO ESO NO PROTEGE NADA
 * ---------------------------------------------------------
 * Esconder el panel evita enseñar botones que van a fallar, y nada más. Lo que
 * impide que un desconocido reescriba la página son las políticas de
 * `supabase/migraciones/0004_tecnologia.sql`.
 *
 * POR QUÉ CADA BLOQUE TIENE SU PROPIO BOTÓN DE GUARDAR
 * ----------------------------------------------------
 * Se pensó en guardar solo con salir del campo, sin botón. Se descartó: escribiendo
 * un párrafo largo eso son decenas de escrituras, y sobre todo deja al administrador
 * sin saber si lo suyo se guardó. Con un botón que se activa al haber cambios, el
 * estado es visible: si está encendido, falta pulsar.
 *
 * CAMPOS SEGÚN EL TIPO
 * --------------------
 * Cada tipo de bloque pide unas cosas distintas, y esa correspondencia vive en
 * `CAMPOS`. Añadir un tipo nuevo es añadir una entrada ahí y su dibujo en
 * `BloqueTecnologia.tsx`; no hay que tocar este componente ni la base de datos.
 */

/** Qué campos pide cada tipo, y cómo se editan. */
type Campo = {
  clave: string;
  etiqueta: string;
  forma: "linea" | "parrafo" | "imagen" | "url" | "filas";
};

const CAMPOS: Record<Tipo, Campo[]> = {
  encabezado: [
    { clave: "antetitulo", etiqueta: "Antetítulo", forma: "linea" },
    { clave: "titulo", etiqueta: "Título", forma: "linea" },
    { clave: "entrada", etiqueta: "Entradilla", forma: "parrafo" },
  ],
  tarjeta: [
    { clave: "titulo", etiqueta: "Título", forma: "linea" },
    { clave: "descripcion", etiqueta: "Descripción", forma: "parrafo" },
    { clave: "imagen", etiqueta: "Imagen", forma: "imagen" },
    { clave: "alt", etiqueta: "Descripción de la imagen", forma: "linea" },
  ],
  texto: [
    { clave: "titulo", etiqueta: "Título", forma: "linea" },
    { clave: "cuerpo", etiqueta: "Texto", forma: "parrafo" },
  ],
  especificacion: [
    { clave: "titulo", etiqueta: "Título", forma: "linea" },
    { clave: "filas", etiqueta: "Filas", forma: "filas" },
  ],
  imagen: [
    { clave: "src", etiqueta: "Imagen", forma: "imagen" },
    { clave: "alt", etiqueta: "Descripción de la imagen", forma: "linea" },
    { clave: "pie", etiqueta: "Pie", forma: "parrafo" },
  ],
  enlace: [
    { clave: "titulo", etiqueta: "Título", forma: "linea" },
    { clave: "descripcion", etiqueta: "Descripción", forma: "parrafo" },
    { clave: "etiqueta", etiqueta: "Texto del botón", forma: "linea" },
    { clave: "url", etiqueta: "Dirección", forma: "url" },
  ],
  video: [
    { clave: "src", etiqueta: "Dirección del vídeo", forma: "url" },
    { clave: "pie", etiqueta: "Pie", forma: "parrafo" },
  ],
};

const NOMBRE_DE_SECCION: Record<string, string> = {
  hardware: "Hardware",
  software: "Software",
  documentacion: "Documentación",
};

export function GestorTecnologia() {
  /** `null` = todavía no se sabe. Distinguirlo de `false` evita el parpadeo. */
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const soyAdmin = await esAdmin();
      if (cancelado) return;
      setAdmin(soyAdmin);
      if (!soyAdmin) {
        setCargando(false);
        return;
      }
      const lista = await leerBloques();
      if (cancelado) return;
      setBloques(lista ?? []);
      setCargando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  /** Vuelve a leer de la base en lugar de adivinar cómo quedó. */
  async function refrescar() {
    setBloques((await leerBloques()) ?? []);
  }

  async function anadir(seccion: string, tipo: Tipo) {
    const enLaSeccion = bloques.filter((b) => b.seccion === seccion);
    // Se deja hueco de diez en diez para poder colar algo en medio más adelante.
    const orden = enLaSeccion.length
      ? Math.max(...enLaSeccion.map((b) => b.orden)) + 10
      : 10;
    const error = await crearBloque(seccion, tipo, {}, orden);
    if (error) toast.error(error);
    else {
      toast.success("Bloque añadido");
      await refrescar();
    }
  }

  if (admin !== true) return null;

  const agrupados = porSeccion(bloques);

  return (
    <section className="px-6 lg:px-10 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-ink/10 bg-card p-6 lg:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-ink">Sección de Tecnología</h2>
            <p className="mt-1 text-sm text-ink/60">
              Lo que hay aquí es lo que se ve en la página de Tecnología. Los cambios
              salen en cuanto se guardan.
            </p>
          </div>

          {cargando ? (
            <div className="flex items-center gap-2 py-8 text-ink/50">
              <Loader2 className="size-5 animate-spin" />
              Cargando el contenido…
            </div>
          ) : (
            <div className="space-y-10">
              {SECCIONES.map((seccion) => (
                <GrupoDeSeccion
                  key={seccion}
                  seccion={seccion}
                  bloques={agrupados.get(seccion) ?? []}
                  onAnadir={(tipo) => void anadir(seccion, tipo)}
                  onCambio={() => void refrescar()}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function GrupoDeSeccion({
  seccion,
  bloques,
  onAnadir,
  onCambio,
}: {
  seccion: string;
  bloques: Bloque[];
  onAnadir: (tipo: Tipo) => void;
  onCambio: () => void;
}) {
  const [tipoNuevo, setTipoNuevo] = useState<Tipo>("tarjeta");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <h3 className="text-lg font-bold text-ink">
          {NOMBRE_DE_SECCION[seccion] ?? seccion}
          <span className="ml-2 text-sm font-normal text-ink/40">
            {bloques.length} {bloques.length === 1 ? "bloque" : "bloques"}
          </span>
        </h3>

        <div className="flex items-center gap-2">
          <select
            value={tipoNuevo}
            onChange={(e) => setTipoNuevo(e.target.value as Tipo)}
            aria-label={`Tipo de bloque a añadir en ${seccion}`}
            className="rounded-xl border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_DEL_TIPO[t]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onAnadir(tipoNuevo)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-deep px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            Añadir
          </button>
        </div>
      </div>

      {bloques.length === 0 ? (
        <p className="py-4 text-sm text-ink/40">
          Sin bloques. Lo que se ve en la web es el contenido de reserva del código.
        </p>
      ) : (
        <div className="space-y-3">
          {bloques.map((bloque, i) => (
            <EditorDeBloque
              key={bloque.id}
              bloque={bloque}
              primero={i === 0}
              ultimo={i === bloques.length - 1}
              vecinoArriba={bloques[i - 1]}
              vecinoAbajo={bloques[i + 1]}
              onCambio={onCambio}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EditorDeBloque({
  bloque,
  primero,
  ultimo,
  vecinoArriba,
  vecinoAbajo,
  onCambio,
}: {
  bloque: Bloque;
  primero: boolean;
  ultimo: boolean;
  vecinoArriba?: Bloque;
  vecinoAbajo?: Bloque;
  onCambio: () => void;
}) {
  const [datos, setDatos] = useState<Record<string, unknown>>(bloque.datos);
  const [ocupado, setOcupado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const entradaImagen = useRef<HTMLInputElement>(null);
  const [campoDeImagen, setCampoDeImagen] = useState<string | null>(null);

  /**
   * `JSON.stringify` para comparar, y no una igualdad por referencia: `datos` es un
   * objeto que se reconstruye en cada cambio, así que comparar referencias diría
   * siempre "hay cambios" y el botón de guardar nunca se apagaría.
   */
  const hayCambios = JSON.stringify(datos) !== JSON.stringify(bloque.datos);

  const campos = CAMPOS[bloque.tipo as Tipo];

  async function guardar() {
    setOcupado(true);
    const error = await guardarBloque(bloque.id, { datos });
    if (error) toast.error(error);
    else {
      toast.success("Bloque guardado");
      onCambio();
    }
    setOcupado(false);
  }

  async function alternarVisible() {
    setOcupado(true);
    const error = await guardarBloque(bloque.id, { visible: !bloque.visible });
    if (error) toast.error(error);
    else onCambio();
    setOcupado(false);
  }

  async function mover(vecino: Bloque | undefined) {
    if (!vecino) return;
    setOcupado(true);
    const error = await intercambiarOrden(bloque, vecino);
    if (error) toast.error(error);
    else onCambio();
    setOcupado(false);
  }

  async function eliminar() {
    // `confirm` y no un diálogo propio: borrar es irreversible y el aviso del
    // navegador no se puede pulsar por descuido tan fácilmente como un botón más.
    if (!window.confirm("¿Borrar este bloque? No se puede deshacer.")) return;
    setOcupado(true);
    const error = await borrarBloque(bloque.id);
    if (error) toast.error(error);
    else {
      toast.success("Bloque borrado");
      onCambio();
    }
    setOcupado(false);
  }

  async function alElegirImagen(archivo: File | undefined) {
    if (!archivo || !campoDeImagen) return;
    setOcupado(true);
    const r = await subirImagen(archivo);
    if ("error" in r) toast.error(r.error);
    else {
      setDatos({ ...datos, [campoDeImagen]: r.url });
      toast.success("Imagen subida. Falta guardar el bloque.");
    }
    setOcupado(false);
  }

  const resumen =
    texto(datos, "titulo") ||
    texto(datos, "antetitulo") ||
    texto(datos, "pie") ||
    "(sin título)";

  return (
    <div className="rounded-2xl border border-ink/10 bg-surface">
      <div className="flex flex-wrap items-center gap-2 p-4">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="shrink-0 rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
            {NOMBRE_DEL_TIPO[bloque.tipo as Tipo] ?? bloque.tipo}
          </span>
          <span
            className={`truncate font-medium ${bloque.visible ? "text-ink" : "text-ink/40 line-through"}`}
          >
            {resumen}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <BotonIcono
            titulo="Subir"
            onClick={() => void mover(vecinoArriba)}
            desactivado={primero || ocupado}
          >
            <ChevronUp className="size-4" />
          </BotonIcono>
          <BotonIcono
            titulo="Bajar"
            onClick={() => void mover(vecinoAbajo)}
            desactivado={ultimo || ocupado}
          >
            <ChevronDown className="size-4" />
          </BotonIcono>
          <BotonIcono
            titulo={bloque.visible ? "Ocultar de la web" : "Mostrar en la web"}
            onClick={() => void alternarVisible()}
            desactivado={ocupado}
          >
            {bloque.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </BotonIcono>
          <BotonIcono titulo="Borrar" onClick={() => void eliminar()} desactivado={ocupado} peligro>
            <Trash2 className="size-4" />
          </BotonIcono>
        </div>
      </div>

      {abierto && (
        <div className="space-y-4 border-t border-ink/10 p-4">
          {campos === undefined ? (
            <p className="text-sm text-ink/50">
              Este bloque es de tipo <code className="font-mono">{bloque.tipo}</code>, que
              esta versión de la web no sabe editar ni dibujar. Se puede borrar o dejarlo
              como está.
            </p>
          ) : (
            campos.map((campo) => (
              <CampoEditable
                key={campo.clave}
                campo={campo}
                datos={datos}
                setDatos={setDatos}
                onPedirImagen={() => {
                  setCampoDeImagen(campo.clave);
                  entradaImagen.current?.click();
                }}
              />
            ))
          )}

          <input
            ref={entradaImagen}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void alElegirImagen(e.target.files?.[0]);
              // Se limpia para que elegir DOS VECES el mismo fichero vuelva a
              // disparar el evento.
              e.target.value = "";
            }}
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={!hayCambios || ocupado}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-deep px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar
            </button>
            {hayCambios && (
              <span className="text-sm text-ink/50">Hay cambios sin guardar</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CampoEditable({
  campo,
  datos,
  setDatos,
  onPedirImagen,
}: {
  campo: Campo;
  datos: Record<string, unknown>;
  setDatos: (d: Record<string, unknown>) => void;
  onPedirImagen: () => void;
}) {
  const clase =
    "w-full rounded-xl border border-ink/15 bg-card px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brand focus:outline-none";
  const valor = texto(datos, campo.clave);
  const poner = (v: string) => setDatos({ ...datos, [campo.clave]: v });

  if (campo.forma === "filas") {
    const lista = filas(datos);
    const ponerFilas = (nuevas: { clave: string; valor: string }[]) =>
      setDatos({ ...datos, filas: nuevas });

    return (
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink/70">{campo.etiqueta}</span>
        <div className="space-y-2">
          {lista.map((fila, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={fila.clave}
                onChange={(e) => {
                  const n = [...lista];
                  n[i] = { ...fila, clave: e.target.value };
                  ponerFilas(n);
                }}
                placeholder="Concepto"
                aria-label={`Concepto de la fila ${i + 1}`}
                className={`${clase} sm:w-56`}
              />
              <input
                value={fila.valor}
                onChange={(e) => {
                  const n = [...lista];
                  n[i] = { ...fila, valor: e.target.value };
                  ponerFilas(n);
                }}
                placeholder="Valor"
                aria-label={`Valor de la fila ${i + 1}`}
                className={clase}
              />
              <button
                type="button"
                onClick={() => ponerFilas(lista.filter((_, j) => j !== i))}
                aria-label={`Quitar la fila ${i + 1}`}
                className="shrink-0 rounded-xl border border-ink/15 px-3 text-ink/50 hover:border-red-500/40 hover:text-red-500"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => ponerFilas([...lista, { clave: "", valor: "" }])}
            className="flex items-center gap-2 rounded-xl border border-ink/15 px-3 py-2 text-sm text-ink/70 hover:border-brand/40 hover:text-brand"
          >
            <Plus className="size-4" />
            Añadir fila
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/70">{campo.etiqueta}</span>

      {campo.forma === "parrafo" ? (
        <textarea
          value={valor}
          onChange={(e) => poner(e.target.value)}
          rows={3}
          className={clase}
        />
      ) : campo.forma === "imagen" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          {valor && (
            <img
              src={valor}
              alt=""
              className="h-20 w-28 shrink-0 rounded-lg border border-ink/10 object-cover"
            />
          )}
          <div className="flex-1 space-y-2">
            <input
              value={valor}
              onChange={(e) => poner(e.target.value)}
              placeholder="/tecnologia/imagen.png o una dirección https://"
              className={clase}
            />
            <button
              type="button"
              onClick={onPedirImagen}
              className="flex items-center gap-2 rounded-xl border border-ink/15 px-3 py-2 text-sm text-ink/70 hover:border-brand/40 hover:text-brand"
            >
              <ImagePlus className="size-4" />
              Subir una imagen
            </button>
          </div>
        </div>
      ) : (
        <input
          value={valor}
          onChange={(e) => poner(e.target.value)}
          placeholder={campo.forma === "url" ? "https://…" : undefined}
          className={clase}
        />
      )}
    </label>
  );
}

function BotonIcono({
  titulo,
  onClick,
  desactivado,
  peligro = false,
  children,
}: {
  titulo: string;
  onClick: () => void;
  desactivado: boolean;
  peligro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      title={titulo}
      aria-label={titulo}
      className={`flex size-9 items-center justify-center rounded-lg border border-ink/10 text-ink/60 transition-colors disabled:opacity-30 ${
        peligro ? "hover:border-red-500/40 hover:text-red-500" : "hover:border-brand/40 hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}
