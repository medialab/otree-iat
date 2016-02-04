# -*- coding: utf-8 -*-
from __future__ import division

from . import models
from ._builtin import Page


class IAT(Page):
    form_model = models.Player
    form_fields = ['iat_results']


page_sequence = [IAT]
