# acd-site

Site-ul static al Asociației pentru Combaterea Dezinformării (https://www.combatereadezinformarii.ro).

Conținutul din `site/` e generat automat din sursele de lucru și se publică prin cPanel → Git Version Control:
**Update from Remote**, apoi **Deploy HEAD Commit**. `.cpanel.yml` copiază `site/` în `public_html` numai adăugând sau suprascriind fișiere.
Nu edita fișierele de aici de mână.
