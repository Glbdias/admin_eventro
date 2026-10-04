# Uso: python scripts/extrair_eventos.py [saida.json]
# Extrai os eventos de turismo.rs.gov.br (listagem + página de detalhe) sem Selenium.
import json
import re
import sys
import time
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://www.turismo.rs.gov.br/turismo/evento/listar/"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"}
ROTULOS = ["Cidade", "Início", "Fim", "Periodo", "Local", "Endereço", "Email", "Âmbito", "Programação"]


def limpar(texto):
	return re.sub(r"\s+", " ", texto).strip() if texto else ""


def iso(data_br, hora):
	try:
		d = datetime.strptime(data_br.strip(), "%d/%m/%Y")
	except ValueError:
		return None
	return f"{d:%Y-%m-%d}T{hora}-03:00"


def campo(texto, rotulo):
	outros = "|".join(r for r in ROTULOS if r != rotulo)
	m = re.search(rf"{rotulo}:\s*(.*?)(?=\s(?:{outros}):|$)", texto)
	return limpar(m.group(1)) if m else ""


def get(sessao, url):
	for tentativa in range(5):
		try:
			r = sessao.get(url, headers=HEADERS, timeout=30)
			r.raise_for_status()
			return r.text
		except requests.RequestException:
			if tentativa == 4:
				raise
			time.sleep(2 * (tentativa + 1))


def detalhe(sessao, url):
	soup = BeautifulSoup(get(sessao, url), "html.parser")
	info = soup.select_one(".cartao .texto p")
	flat = limpar(info.get_text(" ")) if info else ""
	cartaz = None
	capa = soup.select_one(".cartao .cards")
	if capa:
		m = re.search(r"url\(([^)]+)\)", capa.get("style", ""))
		if m and "semfoto" not in m.group(1):
			cartaz = urljoin(url, m.group(1).strip("'\" "))
	# A programação é o último bloco e pode conter "Local:" internamente, então corta direto.
	prog = limpar(flat.split("Programação:", 1)[1]) if "Programação:" in flat else ""
	cabecalho = flat.split("Programação:", 1)[0]
	return {
		"local": campo(cabecalho, "Local"),
		"endereco": campo(cabecalho, "Endereço"),
		"programacao": prog,
		"cartaz": cartaz,
	}


def extrair():
	sessao = requests.Session()
	soup = BeautifulSoup(get(sessao, BASE), "html.parser")
	eventos, vistos = [], set()

	# As 7 páginas da listagem já vêm no mesmo HTML (paginação é feita via JS).
	for card in soup.select("div.eventos div.cartao"):
		titulo_tag = card.select_one(".texto h3")
		link_tag = card.select_one(".leia-mais a")
		if not titulo_tag or not link_tag:
			continue
		link = link_tag["href"].strip()
		if link in vistos:
			continue
		vistos.add(link)

		tipo_tag = card.select_one("h2.titulo-event")
		tipo = limpar(tipo_tag.get_text()) if tipo_tag else ""
		valores = [limpar(h.get_text()) for h in card.select(".info-event h3")]
		inicio, fim, cidade_uf = (valores + ["", "", ""])[:3]
		cidade, _, uf = cidade_uf.partition("/")
		cidade, uf = cidade.strip(), (uf.strip() or "RS")

		paragrafo = card.select_one(".texto p")
		descricao = limpar(next(paragrafo.stripped_strings, "")) if paragrafo else ""

		extra = detalhe(sessao, link)
		time.sleep(1)

		eventos.append({
			"nome_evento": limpar(titulo_tag.get_text()),
			"descricao": extra["programacao"] or descricao,
			"categoria": tipo.upper(),
			"data_inicio": iso(inicio, "09:00:00"),
			"data_fim": iso(fim, "22:00:00"),
			"local": {
				"nome_local": extra["local"] or cidade,
				"cidade": cidade,
				"uf": uf,
				"endereco": extra["endereco"],
				"cep": "",
			},
			"cartaz_url": extra["cartaz"],
			"contato": {"link_mais_informacoes": link, "whatsapp_contato": ""},
		})
		print(f"{len(eventos)}. {eventos[-1]['nome_evento']} ({cidade}/{uf})", file=sys.stderr)
	return eventos


if __name__ == "__main__":
	saida = sys.argv[1] if len(sys.argv) > 1 else "eventos_eventro.json"
	resultado = extrair()
	with open(saida, "w", encoding="utf-8") as f:
		json.dump(resultado, f, indent=2, ensure_ascii=False)
	print(f"[OK] {len(resultado)} eventos gravados em {saida}")
