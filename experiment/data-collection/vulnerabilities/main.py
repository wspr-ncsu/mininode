import requests
import json
from bs4 import BeautifulSoup
import logzero
from logzero import logger

data = {}
data['advisories'] = []
def scrape(url):
  logger.info('Requesting ' + url)
  r = requests.get(url)

  if r.status_code == 200:
    logger.info('Request OK')
    soap = BeautifulSoup(r.text, 'html.parser')
    table = soap.find('tbody')
    rows = table.find_all('tr')
    if len(rows) == 0:
        return
    for row in rows:
        advisory = {}
        links = row.find_all('a')
        advisory['category'] = links[0].get_text().strip()
        advisory['severity'] = row.find('span', {'class':'severity-list__item-text'}).get_text().strip()
        advisory['name'] = links[1].get_text().strip()
        advisory['semver'] = row.find('span',{'class':'semver'}).get_text().strip()
        advisory['date'] = row.find('td', {'class': 'l-align-right t--sm'}).get_text().strip()
        data['advisories'].append(advisory)
        logger.info(advisory)
  else:
    logger.error('Request failed ' + r.status_code)

for i in range(1, 100):
    scrape('https://snyk.io/vuln/page/{}?type=npm'.format(i))

with open('advisories.json', 'w') as output:
    json.dump(data, output, indent=2)