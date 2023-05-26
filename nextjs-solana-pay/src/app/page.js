"use client";
// Modulos React
import { useCallback, useEffect, useRef, useState } from "react";
// Modulos Next
import Image from "next/image";
import Link from "next/link";
// Modulos Solana Web3
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { createQR, encodeURL, findReference } from "@solana/pay";
// Modulos Utilidades
import BigNumber from "bignumber.js";
// Estilo de pagina
import styles from "./page.module.css";

// Utilidad para renderizar QR desde archivo.
function blobToBase64(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export default function Home() {
  // Estados
  const [form, setForm] = useState({
    recipient: "9Luc12KxoUfmEWSQoBbrprPqU76kfrQXkKUsZWoFY59G", // Address receptora
    amount: new BigNumber("0"), // Cantidad a Recibir
    reference: new Keypair().publicKey, // Referencia que usara la blockchain para rastrear la transaccion
    label: "", // Opcional: Nombre de tienda, persona o app que genero la solicitud.
    message: "", // Opcional: Nombre del articulo comprado, numero de pedido o mensaje de agradecimiento.
    memo: "", // Opcional: Informacion que se adjuntara como Log en la transaccion y podra ser visto en la blockchain. (NO PONER DATOS PRIVADOS YA QUE SERA INFORMACION PUBLICA)
  });

  const [qr, setQRcode] = useState(null); // Estado donde guardaremos el QR y lo desplegaremos.
  const [paymentStatus, setPaymentStatus] = useState("Pendiente..."); // Payment Satus para mostrar el estado de la transaccion en todo momento.
  const [paymentTx, setPaymentTx] = useState(""); // Hash de la transaccion y que pondremos en nuestro URL para verlo en el explorer.

  // Conexion a Solana RPC
  var connection = new Connection("https://api.devnet.solana.com", "confirmed");

  //Utilidad para intervalo en caso de no completar la tranferencia de Solana Pay
  let myInterval = useRef(null);

  // Funcion para configurar el QR de Solana Pay y esperar a que la transaccion se complete.
  const setQR = useCallback(async () => {
    // En esta variable temp convertimos los datos de la form a los datos que necesita el SDK de Solana Pay para funcionar
    let temp = {
      ...form,
      recipient: new PublicKey(form.recipient)
    };
    // Sustraemos solo los parametros necesarios para que la funcion encodeURL cree nuestro url
    let { recipient, amount, reference, label, message, memo } = temp;
    // Creamos nuestro URL de pago de solana pay
    const url = encodeURL({
      recipient,
      amount,
      reference,
      label,
      message,
      memo,
    });
    // Convertimos en URL en un QR escaneable por una wallet sin embargo hay que convertilo en una imagen que podamos renderizar
    const qrCode = createQR(url);
    // Obtenemos los datos crudos del archivo de QR
    const rawQR = await qrCode.getRawData();
    // Convertimos el archivo recibido a base64, lo cual ya es un formato que podemos renderizar en un componente de Image
    const base64QR = await blobToBase64(rawQR);
    // Actualizamos el estado de qr, al hacer esto automaticamente aparecera en pantalla
    setQRcode(base64QR);

    // Este segmento realiza un fetch de la referencia cada 1 segundo y regresa el hash de la transaccion una vez se confirma
    const { signature } = await new Promise((resolve, reject) => {
      myInterval.current = setInterval(async () => {
        try {
          console.log(".");
          const signatureInfo = await findReference(connection, reference, {
            finality: "confirmed",
          });
          clearInterval(myInterval.current);
          resolve(signatureInfo);
        } catch (error) {
          //console.log(error)
        }
      }, 1000);
    });
    // Configuramos el pago como confirmado
    setPaymentStatus("Confirmado...");
    // Esperamos a que la transaccion sea validada por la blockchain
    try {
      const latestBlockHash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature,
      });
      // Una vez validada la transaccion actualizamos el hash y el estado de pago para mostrarle el url al usuario y revise su transaccion en la blockchain
      setPaymentStatus("Validado");
      setPaymentTx(signature);
    } catch (error) {
      setPaymentStatus("Fallido");
    }
  }, [connection, form]);

  useEffect(() => {
    // El return en UseEffect se activa una vez el componente se desmonta, asi que limpiamos el intervalo si esta activo.
    return () => {
      const temp = myInterval;
      clearInterval(temp.current);
    };
  }, []);

  // Estilo de el campo de input en la form
  const inputStyle = {
    color: "black",
    backgroundColor: "white",
    textAlign: "center",
    width: "44vw",
    borderRadius: "10px",
    border: "1px solid white",
    fontSize: "24px",
    marginBottom: "10px",
    fontFamily: "Open Sans",
  };

  // Estilo de las etiquetas de la form
  const inputLabelStyle = {
    fontSize: "24px",
    color: "black",
    textAlign: "center",
    fontFamily: "Open Sans",
  };

  return (
    <main className={styles.main}>
      <div className={styles.center}>
        <Image
          className={styles.logo}
          src="/altaga.svg"
          alt="Altaga Logo"
          width={140}
          height={140}
          priority
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-evenly",
          alignItems: "center",
          fontSize: "32px",
        }}
      >
        Solana Pay Boilerplate
      </div>
      <div
        style={{
          height: "1px",
          marginTop: "10px",
          marginBottom: "10px",
          backgroundColor: "#54d6ff33",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-evenly",
          alignItems: "center",
          backgroundColor: "#17EF97",
          borderRadius: "10px",
          padding: "10px",
          marginBottom: "20px",
        }}
      >
        {!qr ? ( // Revisamos el estado el qr, si no hay qr, mostramos la form y cuando lo creemos lo mostramos.
          <div>
            <div style={inputLabelStyle}>Cuenta Receptora</div>
            <input
              type="text"
              defaultValue={form.recipient}
              onChange={(e) => setForm({ ...form, recipient: e.target.value })}
              style={inputStyle}
              placeholder="to Address"
            ></input>
            <div style={inputLabelStyle}>Cantidad</div>
            <input
              defaultValue={form.amount}
              type="number"
              onChange={(e) =>
                setForm({ ...form, amount: new BigNumber(e.target.value) })
              }
              style={inputStyle}
            ></input>
            <div style={inputLabelStyle}>Etiqueta</div>
            <input
              type="text"
              defaultValue={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              style={inputStyle}
              placeholder="optional"
            ></input>
            <div style={inputLabelStyle}>Mensaje</div>
            <input
              defaultValue={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              style={inputStyle}
              placeholder="optional"
            ></input>
            <div style={inputLabelStyle}>Memo</div>
            <input
              defaultValue={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              style={inputStyle}
              placeholder="optional"
            ></input>
            <div
              style={{
                marginTop: "10px",
                marginBottom: "10px",
              }}
            />
            <div
              style={{
                textAlign: "center",
              }}
            >
              <button
                style={{
                  backgroundColor: "#dc1fff",
                  paddingRight: 30,
                  paddingLeft: 30,
                  paddingTop: 3,
                  paddingBottom: 3,
                  borderRadius: "10px",
                  fontSize: "32px",
                  fontFamily: "Open Sans",
                }}
                onClick={() => setQR()}
              >
                Crear QR
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
                fontFamily: "Open Sans",
                padding: "10px 0px",
                color: "black",
              }}
            >
              Escanea el QR con tu Wallet
            </div>
            <Image
              style={{ borderRadius: "10px" }}
              src={qr}
              alt="SolanaQR"
              width={400}
              height={400}
            />
            <div
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
                fontFamily: "Open Sans",
                margin: "20px 0px",
                color: "black",
              }}
            >
              Estatus de Pago : {paymentStatus}{" "}
              {paymentTx && ( // Una vez tengamos el hash aparecemos el link para abrir el explorer.
                <>
                  <br />
                  <Link
                    href={`https://solana.fm/tx/${paymentTx}?cluster=devnet-solana`}
                    target="_blank"
                    style={{
                      fontSize: "1.5rem",
                      color: "black",
                      fontFamily: "Open Sans",
                      textDecoration: "underline"
                    }}
                  >
                    Revisar en Explorer
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
